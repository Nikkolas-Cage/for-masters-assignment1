'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, VStack, Text, Badge, Heading, Button, HStack, Switch, FormControl, FormLabel } from '@chakra-ui/react';

export default function FocusCamera() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [showMesh, setShowMesh] = useState(false);
  const [deviceType, setDeviceType] = useState('Unknown');
  const [isLiveFeed, setIsLiveFeed] = useState(true);
  const [antiCheatStatus, setAntiCheatStatus] = useState('verifying');
  const faceMeshRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const frameTimestampsRef = useRef([]);
  const streamRef = useRef(null);
  const showMeshRef = useRef(false); // Ref to access current showMesh value in callbacks
  const facePositionsRef = useRef([]); // Track face positions over time
  const eyeBlinkHistoryRef = useRef([]); // Track eye blinks
  const lastFacePositionRef = useRef(null);
  const lastEARRef = useRef(null);
  const suspiciousFrameCountRef = useRef(0);

  // Calculate Eye Aspect Ratio (EAR) to detect if eyes are open
  const calculateEAR = (landmarks, eyeIndices) => {
    if (eyeIndices.length < 6) return 0;
    
    const p1 = landmarks[eyeIndices[0]];
    const p2 = landmarks[eyeIndices[1]];
    const p3 = landmarks[eyeIndices[2]];
    const p4 = landmarks[eyeIndices[3]];
    const p5 = landmarks[eyeIndices[4]];
    const p6 = landmarks[eyeIndices[5]];
    
    // Calculate vertical distances
    const vertical1 = Math.sqrt(Math.pow(p2.x - p6.x, 2) + Math.pow(p2.y - p6.y, 2));
    const vertical2 = Math.sqrt(Math.pow(p3.x - p5.x, 2) + Math.pow(p3.y - p5.y, 2));
    // Calculate horizontal distance
    const horizontal = Math.sqrt(Math.pow(p1.x - p4.x, 2) + Math.pow(p1.y - p4.y, 2));
    
    if (horizontal === 0) return 0;
    const ear = (vertical1 + vertical2) / (2.0 * horizontal);
    return ear;
  };

  // Detect device type (laptop vs phone)
  const detectDeviceType = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /ipad|android/i.test(userAgent) && !/mobile/i.test(userAgent);
    
    if (isMobile || isTablet) {
      return 'Mobile Device';
    }
    
    // Check screen size as additional indicator
    const isSmallScreen = window.innerWidth < 768;
    if (isSmallScreen) {
      return 'Mobile/Tablet';
    }
    
    return 'Laptop/Desktop';
  };

  // Anti-cheat detection: Check if feed is live vs pre-recorded or static image
  const checkAntiCheat = (video, faceLandmarks = null) => {
    if (!video) {
      return false;
    }

    frameCountRef.current++;
    let suspiciousScore = 0;
    
    // Check 1: Verify it's a MediaStream (live feed)
    const isMediaStream = video.srcObject instanceof MediaStream;
    if (!isMediaStream) {
      suspiciousScore += 50;
    }

    // Check 2: Verify stream tracks are active and live
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      if (tracks && tracks.length > 0) {
        const videoTrack = tracks.find(track => track.kind === 'video');
        if (videoTrack) {
          // Check if track is live and enabled
          if (videoTrack.readyState !== 'live' || videoTrack.muted) {
            suspiciousScore += 30;
          }
        } else {
          suspiciousScore += 30;
        }
      } else {
        suspiciousScore += 30;
      }
    } else {
      suspiciousScore += 30;
    }

    // Check 3: Video should be playing (not paused)
    if (video.paused || video.ended) {
      suspiciousScore += 40;
    }

    // Check 4: Frame timestamp analysis - detect if frames are updating
    const currentTime = Date.now();
    if (lastFrameTimeRef.current > 0) {
      const timeDiff = currentTime - lastFrameTimeRef.current;
      frameTimestampsRef.current.push(timeDiff);
      
      // Keep only last 50 frames
      if (frameTimestampsRef.current.length > 50) {
        frameTimestampsRef.current.shift();
      }

      // Check for suspicious patterns (too consistent = might be video file)
      if (frameTimestampsRef.current.length > 20) {
        const avgFrameTime = frameTimestampsRef.current.reduce((a, b) => a + b, 0) / frameTimestampsRef.current.length;
        const variance = frameTimestampsRef.current.reduce((sum, val) => sum + Math.pow(val - avgFrameTime, 2), 0) / frameTimestampsRef.current.length;
        
        // Very low variance might indicate pre-recorded video
        if (variance < 0.5 && frameTimestampsRef.current.length > 30) {
          suspiciousScore += 25;
        }
      }
    }
    lastFrameTimeRef.current = currentTime;

    // Check 5: Face movement detection (static images won't move)
    if (faceLandmarks && faceLandmarks.length > 0) {
      const landmarks = faceLandmarks[0];
      const noseTip = landmarks[4];
      const currentPosition = { x: noseTip.x, y: noseTip.y, timestamp: currentTime };
      
      if (lastFacePositionRef.current) {
        // Calculate movement distance
        const movement = Math.sqrt(
          Math.pow(currentPosition.x - lastFacePositionRef.current.x, 2) +
          Math.pow(currentPosition.y - lastFacePositionRef.current.y, 2)
        );
        
        facePositionsRef.current.push({
          position: currentPosition,
          movement: movement
        });
        
        // Keep only last 60 positions (about 2 seconds at 30fps)
        if (facePositionsRef.current.length > 60) {
          facePositionsRef.current.shift();
        }
        
        // Check if face is too stable (static image detection)
        if (facePositionsRef.current.length > 30) {
          const avgMovement = facePositionsRef.current.reduce((sum, item) => sum + item.movement, 0) / facePositionsRef.current.length;
          const movementVariance = facePositionsRef.current.reduce((sum, item) => sum + Math.pow(item.movement - avgMovement, 2), 0) / facePositionsRef.current.length;
          
          // Very low movement and variance = static image or phone screen
          if (avgMovement < 0.001 && movementVariance < 0.0001) {
            suspiciousScore += 40;
            suspiciousFrameCountRef.current++;
          } else {
            suspiciousFrameCountRef.current = Math.max(0, suspiciousFrameCountRef.current - 1);
          }
        }
      }
      
      lastFacePositionRef.current = currentPosition;
    } else {
      // No face detected - could be suspicious if it was detected before
      if (facePositionsRef.current.length > 0) {
        suspiciousScore += 10;
      }
    }

    // Check 6: Eye blink detection (static images won't blink)
    // This will be called from the face detection callback with EAR data
    // For now, we check if we have enough face data but no movement

    // Check 7: Temporal consistency - check if same face position repeats
    if (facePositionsRef.current.length > 20) {
      const recentPositions = facePositionsRef.current.slice(-20);
      const uniquePositions = new Set();
      recentPositions.forEach(item => {
        const key = `${Math.round(item.position.x * 1000)}_${Math.round(item.position.y * 1000)}`;
        uniquePositions.add(key);
      });
      
      // If we have very few unique positions, it's likely a static image
      if (uniquePositions.size < 3) {
        suspiciousScore += 35;
      }
    }

    // Check 8: Video duration - live feeds typically have Infinity
    if (video.duration && !isNaN(video.duration) && video.duration !== Infinity) {
      // If duration is finite and reasonable, might be a video file
      if (video.duration < 3600) { // Less than 1 hour
        suspiciousScore += 15;
      }
    }

    // Check 9: Suspicious frame count threshold
    if (suspiciousFrameCountRef.current > 50) {
      suspiciousScore += 30;
    }

    // Determine status based on suspicious score
    if (suspiciousScore >= 50 || suspiciousFrameCountRef.current > 60) {
      setIsLiveFeed(false);
      setAntiCheatStatus('suspicious');
      return false;
    } else if (suspiciousScore > 30) {
      // Warning but not blocking
      setIsLiveFeed(true);
      setAntiCheatStatus('verifying');
    } else {
      setIsLiveFeed(true);
      setAntiCheatStatus('verified');
    }
    
    return suspiciousScore < 50;
  };

  // Check for eye blinks (called from face detection)
  const checkEyeBlink = (ear) => {
    if (ear === null || ear === undefined) return;
    
    const currentTime = Date.now();
    const isBlinking = ear < 0.2; // Eyes closed
    
    if (lastEARRef.current !== null) {
      const wasBlinking = lastEARRef.current < 0.2;
      
      // Detect blink transition (open -> closed -> open)
      if (!wasBlinking && isBlinking) {
        // Blink started
        eyeBlinkHistoryRef.current.push({
          timestamp: currentTime,
          type: 'blink'
        });
        
        // Keep only last 30 blinks
        if (eyeBlinkHistoryRef.current.length > 30) {
          eyeBlinkHistoryRef.current.shift();
        }
      }
    }
    
    lastEARRef.current = ear;
    
    // Check if we have natural blinking pattern
    if (eyeBlinkHistoryRef.current.length > 10) {
      const recentBlinks = eyeBlinkHistoryRef.current.filter(
        blink => currentTime - blink.timestamp < 10000 // Last 10 seconds
      );
      
      // Normal blinking is 15-20 times per minute
      // If no blinks in 10 seconds, might be static image
      if (recentBlinks.length === 0 && eyeBlinkHistoryRef.current.length > 5) {
        suspiciousFrameCountRef.current += 5;
      }
    }
  };

  // Calculate if person is looking at camera based on eye landmarks
  const isLookingAtCamera = (results) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      return { focused: false, confidence: 0 };
    }

    const landmarks = results.multiFaceLandmarks[0];
    
    // MediaPipe Face Mesh eye landmark indices (6 points for EAR)
    // Left eye outer to inner: 33, 7, 163, 144, 145, 153
    const leftEyePoints = [33, 7, 163, 144, 145, 153];
    // Right eye outer to inner: 362, 382, 380, 374, 263, 390
    const rightEyePoints = [362, 382, 380, 374, 263, 390];

    // Calculate EAR for both eyes
    const leftEAR = calculateEAR(landmarks, leftEyePoints);
    const rightEAR = calculateEAR(landmarks, rightEyePoints);
    const avgEAR = (leftEAR + rightEAR) / 2.0;

    // Eyes should be open (EAR > 0.2 for open eyes, < 0.2 for closed)
    const eyesOpen = avgEAR > 0.2;

    // Calculate head pose - check if face is centered
    const noseTip = landmarks[4]; // Nose tip landmark
    const faceCenterX = 0.5;
    const faceCenterY = 0.5;
    
    // Check if nose is near center (within 0.25 of center)
    const centeredX = Math.abs(noseTip.x - faceCenterX) < 0.25;
    const centeredY = Math.abs(noseTip.y - faceCenterY) < 0.25;

    // Get eye positions for alignment
    const leftEyeOuter = landmarks[33];
    const rightEyeOuter = landmarks[362];
    
    // Check if eyes are aligned horizontally
    const eyeAlignment = Math.abs(leftEyeOuter.y - rightEyeOuter.y) < 0.04;

    // Focus criteria: eyes open, face centered, eyes aligned
    const focused = eyesOpen && centeredX && centeredY && eyeAlignment;
    
    // Calculate confidence (0-100)
    const confidenceScore = Math.min(100, Math.max(0, 
      (eyesOpen ? 40 : 0) + 
      (centeredX ? 25 : 0) + 
      (centeredY ? 25 : 0) + 
      (eyeAlignment ? 10 : 0)
    ));

    return { focused, confidence: confidenceScore, ear: avgEAR };
  };

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    let faceMesh = null;
    const canvasCtx = canvasRef.current.getContext('2d');
    let animationFrameId;
    let stream = null;
    let antiCheatInterval = null;

    // Dynamically import MediaPipe to avoid static analysis issues
    const initFaceMesh = async () => {
      try {
        // Dynamic import to avoid Next.js static analysis
        // MediaPipe uses CommonJS exports
        const faceMeshModule = await import('@mediapipe/face_mesh');
        const FaceMesh = faceMeshModule.FaceMesh;
        
        if (!FaceMesh) {
          throw new Error('FaceMesh not found in module');
        }
        
        faceMesh = new FaceMesh({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
          },
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results) => {
          canvasCtx.save();
          canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const focusResult = isLookingAtCamera(results);
            setIsFocused(focusResult.focused);
            setConfidence(focusResult.confidence);
            setIsDetecting(true);

            // Check for eye blinks
            checkEyeBlink(focusResult.ear);

            // Anti-cheat check with face landmarks
            if (videoRef.current) {
              checkAntiCheat(videoRef.current, results.multiFaceLandmarks);
            }

            const landmarks = results.multiFaceLandmarks[0];
            const noseTip = landmarks[4];
            const x = noseTip.x * canvasRef.current.width;
            const y = noseTip.y * canvasRef.current.height;
            
            // Draw focus indicator circle on nose tip
            canvasCtx.strokeStyle = focusResult.focused ? '#00ff00' : '#ff0000';
            canvasCtx.lineWidth = 3;
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 15, 0, 2 * Math.PI);
            canvasCtx.stroke();

            // Draw face mesh if enabled - use ref to get current value
            if (showMeshRef.current) {
              canvasCtx.strokeStyle = isLiveFeed ? 'rgba(0, 170, 255, 0.6)' : 'rgba(255, 170, 0, 0.6)';
              canvasCtx.lineWidth = 1;
              
              // Draw face mesh - draw key facial features
              // Face outline
              const faceOutline = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10];
              
              canvasCtx.beginPath();
              for (let i = 0; i < faceOutline.length; i++) {
                const idx = faceOutline[i];
                if (idx < landmarks.length) {
                  const point = landmarks[idx];
                  const px = point.x * canvasRef.current.width;
                  const py = point.y * canvasRef.current.height;
                  if (i === 0) {
                    canvasCtx.moveTo(px, py);
                  } else {
                    canvasCtx.lineTo(px, py);
                  }
                }
              }
              canvasCtx.stroke();

              // Draw left eye
              const leftEye = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33];
              canvasCtx.beginPath();
              for (let i = 0; i < leftEye.length; i++) {
                const idx = leftEye[i];
                if (idx < landmarks.length) {
                  const point = landmarks[idx];
                  const px = point.x * canvasRef.current.width;
                  const py = point.y * canvasRef.current.height;
                  if (i === 0) {
                    canvasCtx.moveTo(px, py);
                  } else {
                    canvasCtx.lineTo(px, py);
                  }
                }
              }
              canvasCtx.stroke();

              // Draw right eye
              const rightEye = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 362];
              canvasCtx.beginPath();
              for (let i = 0; i < rightEye.length; i++) {
                const idx = rightEye[i];
                if (idx < landmarks.length) {
                  const point = landmarks[idx];
                  const px = point.x * canvasRef.current.width;
                  const py = point.y * canvasRef.current.height;
                  if (i === 0) {
                    canvasCtx.moveTo(px, py);
                  } else {
                    canvasCtx.lineTo(px, py);
                  }
                }
              }
              canvasCtx.stroke();

              // Draw mouth outline
              const mouth = [61, 146, 91, 181, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318, 61];
              canvasCtx.beginPath();
              for (let i = 0; i < mouth.length; i++) {
                const idx = mouth[i];
                if (idx < landmarks.length) {
                  const point = landmarks[idx];
                  const px = point.x * canvasRef.current.width;
                  const py = point.y * canvasRef.current.height;
                  if (i === 0) {
                    canvasCtx.moveTo(px, py);
                  } else {
                    canvasCtx.lineTo(px, py);
                  }
                }
              }
              canvasCtx.stroke();
            }
          } else {
            setIsDetecting(false);
            setIsFocused(false);
            setConfidence(0);
          }

          canvasCtx.restore();
        });

        faceMeshRef.current = faceMesh;
      } catch (err) {
        console.error('Error loading FaceMesh:', err);
      }
    };

    // Update showMesh ref when state changes
    showMeshRef.current = showMesh;

    // Initialize camera
    const initCamera = async () => {
      try {
        // Detect device type
        const detectedDevice = detectDeviceType();
        setDeviceType(detectedDevice);

        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user' // Front-facing camera
          }
        });
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            await videoRef.current.play();
            await initFaceMesh();
            processVideo();
          };
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setAntiCheatStatus('error');
      }
    };

    // Process video frames
    const processVideo = async () => {
      if (videoRef.current && faceMesh && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        await faceMesh.send({ image: videoRef.current });
      }
      animationFrameId = requestAnimationFrame(processVideo);
    };

    // Periodic anti-cheat check (runs every 500ms)
    antiCheatInterval = setInterval(() => {
      if (videoRef.current) {
        // Check without face data (basic checks)
        checkAntiCheat(videoRef.current, null);
      }
    }, 500);

    initCamera();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (antiCheatInterval) {
        clearInterval(antiCheatInterval);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  // Update ref when showMesh state changes
  useEffect(() => {
    showMeshRef.current = showMesh;
  }, [showMesh]);

  return (
    <Box w="100%" maxW="800px" mx="auto" p={4}>
      <VStack spacing={4}>
        <Heading size="lg">Focus Detection Camera</Heading>
        
        {/* Device and Anti-Cheat Status */}
        <HStack spacing={4} w="100%" justify="center" flexWrap="wrap">
          <Badge colorScheme="blue" fontSize="sm" px={3} py={1}>
            📱 {deviceType}
          </Badge>
          <Badge
            colorScheme={
              antiCheatStatus === 'verified' ? 'green' :
              antiCheatStatus === 'suspicious' ? 'red' : 'yellow'
            }
            fontSize="sm"
            px={3}
            py={1}
          >
            {antiCheatStatus === 'verified' ? '✅ LIVE FEED' :
             antiCheatStatus === 'suspicious' ? '⚠️ SUSPICIOUS' : '🔄 VERIFYING'}
          </Badge>
        </HStack>

        {/* Mesh Toggle */}
        <FormControl display="flex" alignItems="center" justifyContent="center">
          <FormLabel htmlFor="mesh-toggle" mb="0" fontSize="sm">
            Show Face Mesh
          </FormLabel>
          <Switch
            id="mesh-toggle"
            isChecked={showMesh}
            onChange={(e) => {
              const newValue = e.target.checked;
              setShowMesh(newValue);
              showMeshRef.current = newValue; // Update ref immediately
            }}
            colorScheme="blue"
          />
        </FormControl>
        
        <Box position="relative" w="100%" maxW="640px" borderRadius="md" overflow="hidden" border="2px" borderColor={isLiveFeed ? "green.300" : "red.300"}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: 'auto',
              transform: 'scaleX(-1)',
              display: 'block',
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              transform: 'scaleX(-1)',
            }}
            width={640}
            height={480}
          />
        </Box>

        <VStack spacing={2} w="100%">
          <Badge
            colorScheme={isFocused ? 'green' : isDetecting ? 'yellow' : 'gray'}
            fontSize="lg"
            px={4}
            py={2}
          >
            {isFocused ? '🎯 FOCUSED' : isDetecting ? '👀 DETECTING...' : '❌ NO FACE'}
          </Badge>
          
          {isDetecting && (
            <Text fontSize="sm" color="gray.600">
              Confidence: {Math.round(confidence)}%
            </Text>
          )}

          {!isLiveFeed && antiCheatStatus === 'suspicious' && (
            <Badge colorScheme="red" fontSize="sm" px={3} py={1}>
              ⚠️ Pre-recorded video detected! Please use live webcam.
            </Badge>
          )}

          <Text fontSize="sm" color="gray.500" textAlign="center" mt={2}>
            {isFocused 
              ? 'Great! You are focused and looking at the camera.'
              : isDetecting
              ? 'Please look directly at the camera and keep your eyes open.'
              : 'Position yourself in front of the camera.'}
          </Text>
        </VStack>
      </VStack>
    </Box>
  );
}
