'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, VStack, Text, Badge, Heading, Button, HStack, Switch, FormControl, FormLabel, Grid, GridItem, Divider, Input, Collapse, IconButton, Checkbox } from '@chakra-ui/react';
import { ChevronDownIcon, ChevronUpIcon, AddIcon, DeleteIcon } from '@chakra-ui/icons';

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
  const [logs, setLogs] = useState([]);
  const [productivityScore, setProductivityScore] = useState(100);
  const [focusStartTime, setFocusStartTime] = useState(null);
  const [totalFocusTime, setTotalFocusTime] = useState(0);
  const [currentFocusTime, setCurrentFocusTime] = useState(0);
  const [cheatDetections, setCheatDetections] = useState(0);
  const [handsDetected, setHandsDetected] = useState(false);
  const [phoneNearby, setPhoneNearby] = useState(false);
  const [showHandMesh, setShowHandMesh] = useState(true);
  const [micEnabled, setMicEnabled] = useState(false);
  const [keyboardActivity, setKeyboardActivity] = useState(false);
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [isTodoListOpen, setIsTodoListOpen] = useState(true);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const faceMeshRef = useRef(null);
  const handsRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const audioDataRef = useRef(new Uint8Array(0));
  const keyboardNoiseHistoryRef = useRef([]);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const frameTimestampsRef = useRef([]);
  const streamRef = useRef(null);
  const showMeshRef = useRef(false); // Ref to access current showMesh value in callbacks
  const facePositionsRef = useRef([]); // Track face positions over time
  const eyeBlinkHistoryRef = useRef([]); // Track eye blinks
  const lastBlinkTimeRef = useRef(null); // Track last blink timestamp
  const lastFacePositionRef = useRef(null);
  const lastEARRef = useRef(null);
  const eyeMovementHistoryRef = useRef([]); // Track eye movement
  const suspiciousFrameCountRef = useRef(0);
  const lastLogTimeRef = useRef(0);
  const lastCheatStatusRef = useRef('verifying');
  const productivityIntervalRef = useRef(null);
  const wasFocusedRef = useRef(false); // Track previous focus state
  const focusStartTimeRef = useRef(null); // Use ref to avoid closure issues
  const lastSignificantMovementRef = useRef(Date.now()); // Track last significant movement
  const screenDetectionCanvasRef = useRef(null); // Canvas for screen detection analysis
  const lastScreenDetectionRef = useRef(0); // Throttle screen detection
  const noFacePenaltyRef = useRef(0); // Track no-face penalty

  // Calculate XP needed for next level
  const getXpForNextLevel = (currentLevel) => {
    return currentLevel * 100; // 100 XP per level (100, 200, 300, etc.)
  };

  // Check and update level based on XP
  const updateLevel = (newXp) => {
    let calculatedLevel = 1;
    let xpForNext = getXpForNextLevel(calculatedLevel);
    
    while (newXp >= xpForNext) {
      calculatedLevel++;
      xpForNext = getXpForNextLevel(calculatedLevel);
    }
    
    if (calculatedLevel > level) {
      setLevel(calculatedLevel);
      addLog(`🎉 Level Up! You reached level ${calculatedLevel}!`, 'success');
    }
  };

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

  // Add log entry with timestamp
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog = {
      id: Date.now(),
      timestamp,
      message,
      type, // 'info', 'success', 'warning', 'error'
    };
    // Keep last 50 logs in memory, but only display 15 most recent
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  // Calculate productivity score
  const calculateProductivityScore = () => {
    let score = 100;
    
    // Deduct for cheat detections
    score -= cheatDetections * 10;
    
    // Add for focus time (1 point per 10 seconds of focus)
    const totalTime = totalFocusTime + currentFocusTime;
    const focusBonus = Math.floor(totalTime / 10);
    score = Math.min(100, score + focusBonus);
    
    // Deduct for suspicious activity
    if (antiCheatStatus === 'suspicious') {
      score -= 20;
    }
    
    // Ensure score stays within bounds
    return Math.max(0, Math.min(100, score));
  };

  // Get productivity emoji based on score
  const getProductivityEmoji = (score) => {
    if (score >= 90) return '🚀'; // Excellent
    if (score >= 75) return '⭐'; // Great
    if (score >= 60) return '👍'; // Good
    if (score >= 40) return '😐'; // Average
    if (score >= 20) return '😕'; // Poor
    return '😴'; // Very Poor
  };

  // Get status emoji
  const getStatusEmoji = () => {
    if (antiCheatStatus === 'suspicious') return '🚫';
    if (antiCheatStatus === 'verified' && isFocused) return '✅';
    if (antiCheatStatus === 'verified') return '👀';
    return '🔄';
  };

  // Detect phone/tablet shapes with images inside
  const detectPhoneScreen = (video, faceLandmarks = null) => {
    if (!video || !canvasRef.current) return false;
    
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Draw current video frame to canvas for analysis
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Detect rectangular device shapes (phone/tablet)
      const deviceShapes = detectDeviceShapes(data, canvas.width, canvas.height);
      
      if (deviceShapes.length === 0) return false;
      
      // Check if there's a face/image inside any detected device shape
      for (const deviceShape of deviceShapes) {
        // Check if face is inside this device rectangle
        if (faceLandmarks && faceLandmarks.length > 0) {
          const landmarks = faceLandmarks[0];
          const noseTip = landmarks[4];
          
          // Convert normalized coordinates to pixel coordinates
          const faceX = noseTip.x * canvas.width;
          const faceY = noseTip.y * canvas.height;
          
          // Check if face is inside device rectangle
          if (faceX >= deviceShape.x && 
              faceX <= deviceShape.x + deviceShape.width &&
              faceY >= deviceShape.y && 
              faceY <= deviceShape.y + deviceShape.height) {
            // Face is inside a device shape - highly suspicious!
            return true;
          }
        }
        
        // Also check if device shape has characteristics of a screen
        const isScreen = analyzeDeviceShape(deviceShape, data, canvas.width, canvas.height);
        if (isScreen) {
          return true;
        }
      }
      
      return false;
    } catch (err) {
      console.error('Error detecting phone screen:', err);
      return false;
    }
  };

  // Detect rectangular device shapes (phones/tablets) in frame
  const detectDeviceShapes = (data, width, height) => {
    const devices = [];
    
    // Use edge detection to find rectangular shapes
    const edges = detectStrongEdges(data, width, height);
    
    // Find rectangular contours
    const rectangles = findRectangles(edges, width, height);
    
    // Filter for phone/tablet-like rectangles
    for (const rect of rectangles) {
      const aspectRatio = rect.width / rect.height;
      const area = rect.width * rect.height;
      const totalArea = width * height;
      const coverage = area / totalArea;
      
      // Phone/tablet characteristics:
      // - Aspect ratio between 0.4 and 0.7 (portrait) or 1.4 and 2.5 (landscape)
      // - Reasonable size (not too small, not covering entire frame)
      const isPortrait = aspectRatio >= 0.4 && aspectRatio <= 0.7;
      const isLandscape = aspectRatio >= 1.4 && aspectRatio <= 2.5;
      const isReasonableSize = coverage > 0.1 && coverage < 0.8;
      
      if ((isPortrait || isLandscape) && isReasonableSize) {
        devices.push({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          aspectRatio: aspectRatio,
          area: area
        });
      }
    }
    
    return devices;
  };

  // Detect strong edges for shape detection
  const detectStrongEdges = (data, width, height) => {
    const edges = [];
    const threshold = 50; // Edge detection threshold
    
    for (let y = 1; y < height - 1; y += 2) { // Sample every 2nd row
      for (let x = 1; x < width - 1; x += 2) { // Sample every 2nd column
        const idx = (y * width + x) * 4;
        const idxRight = (y * width + (x + 1)) * 4;
        const idxDown = ((y + 1) * width + x) * 4;
        
        // Calculate gradient
        const gradX = Math.abs(data[idx] - data[idxRight]);
        const gradY = Math.abs(data[idx] - data[idxDown]);
        const gradient = Math.sqrt(gradX * gradX + gradY * gradY);
        
        if (gradient > threshold) {
          edges.push({ x, y, strength: gradient });
        }
      }
    }
    
    return edges;
  };

  // Find rectangular shapes from edges
  const findRectangles = (edges, width, height) => {
    const rectangles = [];
    
    if (edges.length < 4) return rectangles;
    
    // Group edges by proximity to find potential rectangles
    const edgeGroups = [];
    const processed = new Set();
    
    for (let i = 0; i < edges.length; i++) {
      if (processed.has(i)) continue;
      
      const group = [edges[i]];
      processed.add(i);
      
      // Find nearby edges
      for (let j = i + 1; j < edges.length; j++) {
        if (processed.has(j)) continue;
        
        const dist = Math.sqrt(
          Math.pow(edges[i].x - edges[j].x, 2) + 
          Math.pow(edges[i].y - edges[j].y, 2)
        );
        
        if (dist < 50) { // Group edges within 50 pixels
          group.push(edges[j]);
          processed.add(j);
        }
      }
      
      if (group.length >= 4) {
        edgeGroups.push(group);
      }
    }
    
    // Convert edge groups to rectangles
    for (const group of edgeGroups) {
      const xs = group.map(e => e.x);
      const ys = group.map(e => e.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      
      const rectWidth = maxX - minX;
      const rectHeight = maxY - minY;
      
      // Only consider substantial rectangles
      if (rectWidth > 50 && rectHeight > 50) {
        rectangles.push({
          x: minX,
          y: minY,
          width: rectWidth,
          height: rectHeight
        });
      }
    }
    
    return rectangles;
  };

  // Analyze if device shape has screen-like characteristics
  const analyzeDeviceShape = (deviceShape, data, width, height) => {
    // Sample pixels inside the device rectangle
    const samples = [];
    const sampleStep = 5;
    
    for (let y = deviceShape.y; y < deviceShape.y + deviceShape.height; y += sampleStep) {
      if (y < 0 || y >= height) continue;
      for (let x = deviceShape.x; x < deviceShape.x + deviceShape.width; x += sampleStep) {
        if (x < 0 || x >= width) continue;
        const idx = (y * width + x) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        samples.push(brightness);
      }
    }
    
    if (samples.length === 0) return false;
    
    // Calculate variance - screens often have more uniform colors
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length;
    
    // Low variance might indicate a screen (uniform colors)
    // But also check for edges around the rectangle (device border)
    const hasBorder = checkForBorder(deviceShape, data, width, height);
    
    // Screen characteristics: low variance + visible border
    return variance < 0.2 && hasBorder;
  };

  // Check for border around device shape
  const checkForBorder = (deviceShape, data, width, height) => {
    let borderEdges = 0;
    const borderWidth = 5;
    const edgeThreshold = 40;
    
    // Check top and bottom borders
    for (let x = deviceShape.x; x < deviceShape.x + deviceShape.width; x += 2) {
      if (x >= 0 && x < width) {
        // Top border
        const topY = Math.max(0, deviceShape.y - borderWidth);
        if (topY < height) {
          const idx = (topY * width + x) * 4;
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          if (brightness < 50 || brightness > 200) borderEdges++; // Dark or bright border
        }
        
        // Bottom border
        const bottomY = Math.min(height - 1, deviceShape.y + deviceShape.height + borderWidth);
        if (bottomY >= 0) {
          const idx = (bottomY * width + x) * 4;
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          if (brightness < 50 || brightness > 200) borderEdges++;
        }
      }
    }
    
    // Check left and right borders
    for (let y = deviceShape.y; y < deviceShape.y + deviceShape.height; y += 2) {
      if (y >= 0 && y < height) {
        // Left border
        const leftX = Math.max(0, deviceShape.x - borderWidth);
        if (leftX < width) {
          const idx = (y * width + leftX) * 4;
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          if (brightness < 50 || brightness > 200) borderEdges++;
        }
        
        // Right border
        const rightX = Math.min(width - 1, deviceShape.x + deviceShape.width + borderWidth);
        if (rightX >= 0) {
          const idx = (y * width + rightX) * 4;
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          if (brightness < 50 || brightness > 200) borderEdges++;
        }
      }
    }
    
    // If we found many border edges, likely a device
    return borderEdges > 20;
  };

  // Helper: Detect edges in image
  const detectEdges = (data, width, height) => {
    let edgePixels = 0;
    const threshold = 30; // Edge detection threshold
    
    for (let y = 1; y < height - 1; y += 5) { // Sample every 5th row for performance
      for (let x = 1; x < width - 1; x += 5) { // Sample every 5th column
        const idx = (y * width + x) * 4;
        const idxRight = (y * width + (x + 1)) * 4;
        const idxDown = ((y + 1) * width + x) * 4;
        
        // Simple edge detection (gradient)
        const gradX = Math.abs(data[idx] - data[idxRight]);
        const gradY = Math.abs(data[idx] - data[idxDown]);
        
        if (gradX > threshold || gradY > threshold) {
          edgePixels++;
        }
      }
    }
    
    return edgePixels / ((width / 5) * (height / 5));
  };

  // Helper: Calculate color variance
  const calculateColorVariance = (data) => {
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    
    // Sample pixels for performance
    for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      sum += brightness;
      sumSq += brightness * brightness;
      count++;
    }
    
    const mean = sum / count;
    const variance = (sumSq / count) - (mean * mean);
    return variance / 255; // Normalize
  };

  // Helper: Detect screen refresh patterns
  const detectRefreshPattern = (data, width, height) => {
    // Screens often have subtle refresh patterns
    // Look for repeating patterns in brightness
    let patternMatches = 0;
    
    // Sample center area where face would be
    const centerY = Math.floor(height / 2);
    const centerX = Math.floor(width / 2);
    const sampleSize = 50;
    
    for (let y = centerY - sampleSize; y < centerY + sampleSize; y += 10) {
      if (y < 0 || y >= height) continue;
      for (let x = centerX - sampleSize; x < centerX + sampleSize; x += 10) {
        if (x < 0 || x >= width) continue;
        const idx = (y * width + x) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        
        // Check for repeating brightness patterns (screen refresh)
        if (brightness % 10 < 2) { // Pattern detection
          patternMatches++;
        }
      }
    }
    
    return patternMatches > 20; // Threshold for pattern detection
  };

  // Helper: Detect glare/reflections
  const detectGlare = (data, width, height) => {
    let brightPixels = 0;
    const glareThreshold = 200; // Brightness threshold for glare
    
    // Check center area
    const centerY = Math.floor(height / 2);
    const centerX = Math.floor(width / 2);
    const sampleSize = 100;
    
    for (let y = centerY - sampleSize; y < centerY + sampleSize; y += 5) {
      if (y < 0 || y >= height) continue;
      for (let x = centerX - sampleSize; x < centerX + sampleSize; x += 5) {
        if (x < 0 || x >= width) continue;
        const idx = (y * width + x) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        
        if (brightness > glareThreshold) {
          brightPixels++;
        }
      }
    }
    
    // High concentration of bright pixels might indicate screen glare
    return brightPixels > 50;
  };

  // Helper: Detect face rectangle bounds
  const detectFaceRectangle = () => {
    if (facePositionsRef.current.length === 0) return null;
    
    const positions = facePositionsRef.current.map(p => p.position);
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));
    
    return {
      minX, maxX, minY, maxY,
      width: maxX - minX,
      height: maxY - minY,
      aspectRatio: (maxX - minX) / (maxY - minY)
    };
  };

  // Draw hand mesh on canvas
  const drawHandMesh = (results, ctx) => {
    if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;
    if (!canvasRef.current) return;
    
    const isPhoneNearby = phoneNearby; // Capture current state
    ctx.strokeStyle = isPhoneNearby ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    
    for (const landmarks of results.multiHandLandmarks) {
      // Draw hand connections
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index
        [0, 9], [9, 10], [10, 11], [11, 12], // Middle
        [0, 13], [13, 14], [14, 15], [15, 16], // Ring
        [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
        [5, 9], [9, 13], [13, 17], // Palm
      ];
      
      // Draw connections
      for (const [start, end] of connections) {
        if (landmarks[start] && landmarks[end]) {
          ctx.beginPath();
          ctx.moveTo(
            landmarks[start].x * canvasRef.current.width,
            landmarks[start].y * canvasRef.current.height
          );
          ctx.lineTo(
            landmarks[end].x * canvasRef.current.width,
            landmarks[end].y * canvasRef.current.height
          );
          ctx.stroke();
        }
      }
      
      // Draw landmarks
      ctx.fillStyle = isPhoneNearby ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 255, 255, 0.8)';
      for (const landmark of landmarks) {
        ctx.beginPath();
        ctx.arc(
          landmark.x * canvasRef.current.width,
          landmark.y * canvasRef.current.height,
          3,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    }
  };

  // Detect phone near hands
  const detectPhoneNearHands = (handLandmarks, canvas) => {
    if (!handLandmarks || handLandmarks.length === 0) return false;
    
    // Check if hands are holding something rectangular (phone)
    for (const landmarks of handLandmarks) {
      // Get hand bounding box
      const xCoords = landmarks.map(lm => lm.x);
      const yCoords = landmarks.map(lm => lm.y);
      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);
      
      const width = maxX - minX;
      const height = maxY - minY;
      const aspectRatio = width / height;
      
      // Phones are typically rectangular (aspect ratio ~0.5-0.6 for portrait)
      // Check if hand area suggests holding a rectangular object
      if (aspectRatio > 0.4 && aspectRatio < 0.7) {
        // Check hand pose - if fingers are spread, might be holding phone
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        
        // Calculate distances between fingertips
        const thumbIndexDist = Math.sqrt(
          Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2)
        );
        const indexMiddleDist = Math.sqrt(
          Math.pow(indexTip.x - middleTip.x, 2) + Math.pow(indexTip.y - middleTip.y, 2)
        );
        
        // If fingers are spread wide, might be holding a phone
        if (thumbIndexDist > 0.15 || indexMiddleDist > 0.1) {
          return true;
        }
      }
      
      // Check if hand is near face (holding phone up to face)
      if (lastFacePositionRef.current) {
        const handCenterX = (minX + maxX) / 2;
        const handCenterY = (minY + maxY) / 2;
        const faceX = lastFacePositionRef.current.x;
        const faceY = lastFacePositionRef.current.y;
        
        const distance = Math.sqrt(
          Math.pow(handCenterX - faceX, 2) + Math.pow(handCenterY - faceY, 2)
        );
        
        // If hand is very close to face, might be holding phone
        if (distance < 0.2) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Helper: Check if face area suggests rectangular device
  const isRectangularDevice = (faceRect, canvasWidth, canvasHeight) => {
    // Phone screens are typically rectangular
    // If face is in a very rectangular area, might be a phone
    const faceAspectRatio = faceRect.aspectRatio;
    const faceArea = faceRect.width * faceRect.height;
    const canvasArea = canvasWidth * canvasHeight;
    const faceCoverage = faceArea / canvasArea;
    
    // Phone screens often show face in a rectangular frame
    // Check if face area is unusually rectangular and covers significant portion
    return (faceAspectRatio > 0.7 && faceAspectRatio < 1.3) && faceCoverage > 0.3;
  };

  // Initialize microphone for keyboard noise detection
  const initMicrophone = async () => {
    try {
      // Check if microphone is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicEnabled(false);
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      microphoneRef.current = microphone;
      
      const bufferLength = analyser.frequencyBinCount;
      audioDataRef.current = new Uint8Array(bufferLength);
      
      setMicEnabled(true);
      addLog('Microphone enabled for keyboard detection', 'success');
      
      // Start analyzing audio
      analyzeKeyboardNoise();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      // Don't log error if user denied permission - it's optional
      if (err.name !== 'NotAllowedError' && err.name !== 'PermissionDeniedError') {
        addLog('Microphone unavailable - keyboard detection disabled', 'info');
      }
      setMicEnabled(false);
    }
  };

  // Analyze audio for keyboard typing sounds
  const analyzeKeyboardNoise = () => {
    if (!analyserRef.current) return;
    
    const analyser = analyserRef.current;
    analyser.getByteFrequencyData(audioDataRef.current);
    
    // Keyboard sounds are typically in the 1-4kHz range
    // Look for sharp spikes in frequency domain (key presses)
    const keyboardFreqStart = Math.floor((1000 / (analyser.context.sampleRate / 2)) * audioDataRef.current.length);
    const keyboardFreqEnd = Math.floor((4000 / (analyser.context.sampleRate / 2)) * audioDataRef.current.length);
    
    let keyboardEnergy = 0;
    let peakCount = 0;
    const threshold = 100; // Threshold for detecting key presses
    
    for (let i = keyboardFreqStart; i < keyboardFreqEnd && i < audioDataRef.current.length; i++) {
      const value = audioDataRef.current[i];
      keyboardEnergy += value;
      if (value > threshold) {
        peakCount++;
      }
    }
    
    const avgEnergy = keyboardEnergy / (keyboardFreqEnd - keyboardFreqStart);
    const hasKeyboardActivity = peakCount > 3 || avgEnergy > 50;
    
    keyboardNoiseHistoryRef.current.push({
      timestamp: Date.now(),
      hasActivity: hasKeyboardActivity,
      energy: avgEnergy,
      peaks: peakCount
    });
    
    // Keep last 30 samples (1 second at 30fps)
    if (keyboardNoiseHistoryRef.current.length > 30) {
      keyboardNoiseHistoryRef.current.shift();
    }
    
    // Update keyboard activity state
    const recentActivity = keyboardNoiseHistoryRef.current.filter(
      sample => Date.now() - sample.timestamp < 2000 // Last 2 seconds
    ).filter(sample => sample.hasActivity);
    
    setKeyboardActivity(recentActivity.length > 5);
    
    // Continue analyzing
    if (analyserRef.current) {
      requestAnimationFrame(analyzeKeyboardNoise);
    }
  };

  // Check keyboard activity as positive signal
  const checkKeyboardActivity = () => {
    if (!micEnabled) return 0; // No penalty if mic not available
    
    const recentSamples = keyboardNoiseHistoryRef.current.filter(
      sample => Date.now() - sample.timestamp < 5000 // Last 5 seconds
    );
    
    if (recentSamples.length === 0) return 0;
    
    const activityCount = recentSamples.filter(s => s.hasActivity).length;
    const activityRatio = activityCount / recentSamples.length;
    
    // If keyboard activity detected, it's a positive signal (person is working)
    // No keyboard activity for extended period might be suspicious
    if (activityRatio < 0.1 && recentSamples.length > 10) {
      // Very low keyboard activity - might be watching video/phone instead of working
      return 15; // Small penalty
    }
    
    return 0; // Keyboard activity is good
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
      suspiciousScore += 40; // Reduced from 50
    }

    // Check 2: Verify stream tracks are active and live
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      if (tracks && tracks.length > 0) {
        const videoTrack = tracks.find(track => track.kind === 'video');
        if (videoTrack) {
          // Check if track is live and enabled
          if (videoTrack.readyState !== 'live' || videoTrack.muted) {
            suspiciousScore += 25; // Reduced from 30
          }
        } else {
          suspiciousScore += 25; // Reduced
        }
      } else {
        suspiciousScore += 25; // Reduced
      }
    } else {
      suspiciousScore += 25; // Reduced
    }

    // Check 3: Video should be playing (not paused)
    if (video.paused || video.ended) {
      suspiciousScore += 30; // Reduced from 40
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
        // More lenient - only flag if extremely consistent
        if (variance < 0.2 && frameTimestampsRef.current.length > 40) {
          suspiciousScore += 15; // Reduced from 25
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
        
        // Track significant movement for liveness check
        if (movement > 0.002) {
          lastSignificantMovementRef.current = currentTime;
        }
        
        // Keep only last 60 positions (about 2 seconds at 30fps)
        if (facePositionsRef.current.length > 60) {
          facePositionsRef.current.shift();
        }
        
        // Allow natural stillness - don't penalize for being still
        // Track significant movement for liveness check
        if (movement > 0.002) {
          lastSignificantMovementRef.current = currentTime;
        }
      }
      
      lastFacePositionRef.current = currentPosition;
    } else {
      // No face detected = Focus Lost
      if (facePositionsRef.current.length > 0) {
        suspiciousScore += 15; // Increased penalty
        noFacePenaltyRef.current += 1;
        
        // No face = Focus Lost - increment cheat detections
        if (noFacePenaltyRef.current > 10) { // After 10 frames without face
          setCheatDetections(prev => prev + 0.1); // Increment Focus Lost counter
          setProductivityScore(prev => Math.max(0, prev - 2)); // Deduct 2 points
          noFacePenaltyRef.current = 0; // Reset counter
        }
      }
    }

    // Check 6: Eye blink detection (static images won't blink)
    // This will be called from the face detection callback with EAR data
    // For now, we check if we have enough face data but no movement

    // Removed: Temporal consistency check - too strict for legitimate users

    // Check 8: Video duration - live feeds typically have Infinity
    if (video.duration && !isNaN(video.duration) && video.duration !== Infinity) {
      // If duration is finite and reasonable, might be a video file
      if (video.duration < 3600) { // Less than 1 hour
        suspiciousScore += 15;
      }
    }

    // Check 9: Suspicious frame count threshold - only for phone screen detection
    if (suspiciousFrameCountRef.current > 80) {
      suspiciousScore += 20;
    }

    // Check 10: Phone/Tablet Shape Detection - IMMEDIATE CHEATING DETECTION
    // Throttle to once per 3 seconds to avoid performance issues
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const timeSinceLastCheck = currentTime - lastScreenDetectionRef.current;
      if (timeSinceLastCheck > 3000) { // Check every 3 seconds
        const phoneScreenDetected = detectPhoneScreen(videoRef.current, faceLandmarks);
        if (phoneScreenDetected) {
          // Phone detected = IMMEDIATE CHEATING WITH CONTINUOUS SEVERE PUNISHMENT
          setIsLiveFeed(false);
          setAntiCheatStatus('suspicious');
          
          // CONTINUOUS SEVERE PUNISHMENT for phone/tablet detection
          setCheatDetections(prev => prev + 0.02); // Continuous penalty every check
          suspiciousFrameCountRef.current += 15; // Increased from 10
          
          // Deduct focus score continuously while phone is detected
          setProductivityScore(prev => Math.max(0, prev - 3)); // Deduct 3 points per check
          
          // Reset focus time if currently focused
          if (focusStartTimeRef.current) {
            const focusDuration = (Date.now() - focusStartTimeRef.current) / 1000;
            setTotalFocusTime(prev => prev + focusDuration);
            focusStartTimeRef.current = null;
            setFocusStartTime(null);
            wasFocusedRef.current = false;
          }
          
          if (timeSinceLastCheck > 3000 && timeSinceLastCheck < 4000) {
            addLog('Phone/Tablet detected - CHEATING! Continuous penalties!', 'error');
          }
          lastScreenDetectionRef.current = currentTime;
          return false; // Immediately return as cheating
        }
        lastScreenDetectionRef.current = currentTime;
      }
    }

    // Check 11: Phone Near Hands Detection - IMMEDIATE CHEATING WITH SEVERE PUNISHMENT
    // If phone is detected near hands, it's CHEATING - CONTINUOUS PUNISHMENT
    if (phoneNearby) {
      // Phone detected = IMMEDIATE CHEATING
      setIsLiveFeed(false);
      setAntiCheatStatus('suspicious');
      
      // CONTINUOUS SEVERE PUNISHMENT while phone is detected
      setCheatDetections(prev => prev + 0.02); // Continuous penalty every check
      suspiciousFrameCountRef.current += 15; // Increased from 10
      
      // Deduct focus score continuously while phone is detected
      setProductivityScore(prev => Math.max(0, prev - 3)); // Deduct 3 points per check (every 500ms)
      
      // Reset focus time if currently focused
      if (focusStartTimeRef.current) {
        const focusDuration = (Date.now() - focusStartTimeRef.current) / 1000;
        setTotalFocusTime(prev => prev + focusDuration);
        focusStartTimeRef.current = null;
        setFocusStartTime(null);
        wasFocusedRef.current = false;
      }
      
      if (lastCheatStatusRef.current !== 'suspicious') {
        addLog('Phone detected - CHEATING! Continuous penalties applied!', 'error');
      }
      lastCheatStatusRef.current = 'suspicious';
      return false; // Immediately return as cheating
    }

    // Check 12: Eye Movement and Blink Analysis
    // Check for suspicious eye behavior (no blinks for 6+ seconds, low eye movement)
    const eyeSuspicionScore = checkSuspiciousEyeBehavior();
    suspiciousScore += eyeSuspicionScore;
    
    // Check 13: Keyboard Activity Analysis (positive signal)
    // No keyboard activity might indicate watching video/phone instead of working
    const keyboardSuspicion = checkKeyboardActivity();
    suspiciousScore += keyboardSuspicion;
    
    // Combined suspicion: Phone + No Blinks = Very Suspicious
    if (phoneNearby && lastBlinkTimeRef.current) {
      const timeSinceLastBlink = currentTime - lastBlinkTimeRef.current;
      if (timeSinceLastBlink > 8000) { // 8 seconds - more realistic
        suspiciousScore += 20; // Reduced penalty - more realistic
        suspiciousFrameCountRef.current += 4; // Reduced
        if (timeSinceLastBlink > 8000 && timeSinceLastBlink < 9000) {
          addLog('Phone detected + No blinks for 8+ seconds', 'warning');
        }
      }
    }
    
    // Combined: Phone + No Keyboard Activity = Suspicious (if mic enabled)
    if (phoneNearby && micEnabled && !keyboardActivity) {
      // Only flag if sustained - check last 10 seconds
      const recentKeyboard = keyboardNoiseHistoryRef.current.filter(
        s => currentTime - s.timestamp < 10000
      );
      if (recentKeyboard.length > 20 && recentKeyboard.filter(s => s.hasActivity).length < 2) {
        suspiciousScore += 15; // Reduced
        suspiciousFrameCountRef.current += 2;
      }
    }
    
    // Positive signal: Keyboard activity while focused = Good
    if (keyboardActivity && isFocused && micEnabled) {
      // Reduce suspicion if person is actively working (typing)
      suspiciousScore = Math.max(0, suspiciousScore - 5);
    }

    // Determine status based on suspicious score - More realistic thresholds
    const now = Date.now();
    
    // More nuanced scoring - require multiple indicators (human-like judgment)
    // Single suspicious indicator shouldn't trigger full alert
    // Consider positive signals (keyboard activity) to reduce false positives
    
    // Calculate net suspicion (subtract positive signals)
    let netSuspicion = suspiciousScore;
    if (keyboardActivity && isFocused) {
      netSuspicion = Math.max(0, netSuspicion - 10); // Reduce suspicion if actively working
    }
    
    // Require strong evidence for cheating (but phone detection already handled above)
    const hasStrongEvidence = netSuspicion >= 80 || 
                              (netSuspicion >= 60 && suspiciousFrameCountRef.current > 100);
    
    if (hasStrongEvidence || suspiciousFrameCountRef.current > 150) {
      setIsLiveFeed(false);
      if (antiCheatStatus !== 'suspicious') {
        setAntiCheatStatus('suspicious');
        setCheatDetections(prev => prev + 0.01);
        addLog('Suspicious activity detected - please use live camera', 'error');
      }
      return false;
    } else if (netSuspicion > 50 || suspiciousFrameCountRef.current > 80) {
      // Warning but not blocking - moderate suspicion
      setIsLiveFeed(true);
      if (antiCheatStatus !== 'verifying') {
        setAntiCheatStatus('verifying');
        // Don't log every time - only on status change
      }
    } else {
      setIsLiveFeed(true);
      if (antiCheatStatus !== 'verified') {
        setAntiCheatStatus('verified');
        if (lastCheatStatusRef.current === 'suspicious') {
          addLog('System verified - Live feed confirmed.', 'success');
        }
      }
    }
    
    lastCheatStatusRef.current = antiCheatStatus;
    return suspiciousScore < 50;
  };

  // Check for eye blinks and movement (called from face detection)
  const checkEyeBlink = (ear, landmarks = null) => {
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
        lastBlinkTimeRef.current = currentTime; // Update last blink time
        
        // Keep only last 30 blinks
        if (eyeBlinkHistoryRef.current.length > 30) {
          eyeBlinkHistoryRef.current.shift();
        }
      }
    }
    
    lastEARRef.current = ear;
    
    // Track eye movement if landmarks available
    if (landmarks && landmarks.length > 0) {
      const leftEyeCenter = landmarks[468] || landmarks[33];
      const rightEyeCenter = landmarks[473] || landmarks[362];
      
      if (leftEyeCenter && rightEyeCenter) {
        const eyeMovement = {
          timestamp: currentTime,
          leftEyeX: leftEyeCenter.x,
          leftEyeY: leftEyeCenter.y,
          rightEyeX: rightEyeCenter.x,
          rightEyeY: rightEyeCenter.y,
        };
        
        eyeMovementHistoryRef.current.push(eyeMovement);
        // Keep last 180 frames (6 seconds at 30fps)
        if (eyeMovementHistoryRef.current.length > 180) {
          eyeMovementHistoryRef.current.shift();
        }
      }
    }
  };

  // Check for suspicious eye behavior (no blinks for 6+ seconds) - More realistic
  const checkSuspiciousEyeBehavior = () => {
    const currentTime = Date.now();
    let suspiciousEyeScore = 0;
    
    // Check 1: No blinks for 6+ seconds - More lenient
    if (lastBlinkTimeRef.current) {
      const timeSinceLastBlink = currentTime - lastBlinkTimeRef.current;
      // Only flag if no blinks for 8+ seconds (more realistic)
      if (timeSinceLastBlink > 8000) { // 8 seconds instead of 6
        suspiciousEyeScore += 20; // Reduced from 30
        // Only log once per detection to avoid spam
        if (timeSinceLastBlink > 8000 && timeSinceLastBlink < 9000) {
          addLog(`No blink detected for ${Math.round(timeSinceLastBlink / 1000)}s`, 'warning');
        }
      }
    } else if (frameCountRef.current > 240) {
      // No blinks detected at all after 8 seconds (240 frames at 30fps)
      suspiciousEyeScore += 25; // Reduced from 40
      if (frameCountRef.current > 240 && frameCountRef.current < 270) {
        addLog('No eye blinks detected - please blink naturally', 'warning');
      }
    }
    
    // Check 2: Eye movement analysis - More lenient
    if (eyeMovementHistoryRef.current.length > 90) {
      const recentMovements = eyeMovementHistoryRef.current.slice(-90);
      let totalEyeMovement = 0;
      
      for (let i = 1; i < recentMovements.length; i++) {
        const prev = recentMovements[i - 1];
        const curr = recentMovements[i];
        const movement = Math.sqrt(
          Math.pow(curr.leftEyeX - prev.leftEyeX, 2) + 
          Math.pow(curr.leftEyeY - prev.leftEyeY, 2) +
          Math.pow(curr.rightEyeX - prev.rightEyeX, 2) + 
          Math.pow(curr.rightEyeY - prev.rightEyeY, 2)
        );
        totalEyeMovement += movement;
      }
      
      const avgEyeMovement = totalEyeMovement / (recentMovements.length - 1);
      
      // Very low eye movement = suspicious, but more lenient threshold
      if (avgEyeMovement < 0.00005) { // More lenient threshold
        suspiciousEyeScore += 15; // Reduced from 25
      }
    }
    
    return suspiciousEyeScore;
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
            const wasFocused = wasFocusedRef.current;
            setIsFocused(focusResult.focused);
            setConfidence(focusResult.confidence);
            setIsDetecting(true);
            
            // Penalty for low confidence (below 80%)
            if (focusResult.confidence < 80) {
              setCheatDetections(prev => prev + 0.001);
              addLog(`Low confidence (${Math.round(focusResult.confidence)}%) - Cheat detection increased`, 'warning');
            }

            // Track focus time using ref to avoid closure issues
            if (focusResult.focused && !wasFocused) {
              // Started focusing
              const startTime = Date.now();
              focusStartTimeRef.current = startTime;
              setFocusStartTime(startTime);
              wasFocusedRef.current = true;
              addLog('Focus detected - You are looking at the camera.', 'success');
            } else if (!focusResult.focused && wasFocused) {
              // Lost focus
              if (focusStartTimeRef.current) {
                const focusDuration = (Date.now() - focusStartTimeRef.current) / 1000;
                setTotalFocusTime(prev => prev + focusDuration);
                addLog(`Lost focus after ${Math.round(focusDuration)}s`, 'warning');
                focusStartTimeRef.current = null;
                setFocusStartTime(null);
              }
              wasFocusedRef.current = false;
            } else if (focusResult.focused) {
              // Still focused - update ref
              wasFocusedRef.current = true;
            } else {
              wasFocusedRef.current = false;
            }

            // Get landmarks for eye tracking and drawing
            const landmarks = results.multiFaceLandmarks[0];

            // Check for eye blinks and movement
            checkEyeBlink(focusResult.ear, landmarks);

            // Anti-cheat check with face landmarks
            if (videoRef.current) {
              checkAntiCheat(videoRef.current, results.multiFaceLandmarks);
            }

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
            
            // Draw hand mesh if enabled and hands detected
            if (showHandMesh && handsRef.current && handsRef.current.lastResults) {
              drawHandMesh(handsRef.current.lastResults, canvasCtx);
            }
          } else {
            if (isDetecting) {
              addLog('Face not detected - Focus Lost', 'warning');
            }
            setIsDetecting(false);
            setIsFocused(false);
            setConfidence(0);
            if (focusStartTimeRef.current && wasFocusedRef.current) {
              // Lost focus - add time
              const focusDuration = (Date.now() - focusStartTimeRef.current) / 1000;
              setTotalFocusTime(prev => prev + focusDuration);
              focusStartTimeRef.current = null;
              setFocusStartTime(null);
            }
            wasFocusedRef.current = false;
            
            // No face = Focus Lost - increment cheat detections
            noFacePenaltyRef.current += 1;
            if (noFacePenaltyRef.current > 10) { // Every 10 frames without face
              setCheatDetections(prev => prev + 0.1); // Increment Focus Lost counter
              setProductivityScore(prev => Math.max(0, prev - 3)); // Deduct 3 points
              noFacePenaltyRef.current = 0;
              addLog('No face detected - Focus Lost', 'warning');
            }
          }

          canvasCtx.restore();
        });

        faceMeshRef.current = faceMesh;
      } catch (err) {
        console.error('Error loading FaceMesh:', err);
      }
    };

    // Initialize MediaPipe Hands
    const initHands = async () => {
      try {
        const handsModule = await import('@mediapipe/hands');
        const Hands = handsModule.Hands;
        
        if (!Hands) {
          throw new Error('Hands not found in module');
        }
        
        const hands = new Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          },
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results) => {
          // Process hand results
          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            setHandsDetected(true);
            
            // Check for phone near hands
            const phoneDetected = detectPhoneNearHands(results.multiHandLandmarks, canvasRef.current);
            if (phoneDetected && !phoneNearby) {
              setPhoneNearby(true);
              // SEVERE PUNISHMENT when phone first detected
              setCheatDetections(prev => prev + 0.05);
              setProductivityScore(prev => Math.max(0, prev - 10)); // Heavy penalty
              addLog('Uh OH! What happened here?', 'error');
            } else if (!phoneDetected && phoneNearby) {
              setPhoneNearby(false);
              addLog('Phone removed - but suspicion remains', 'warning');
            }
            
            // Store hand results for drawing (will be drawn in face mesh callback)
            handsRef.current.lastResults = results;
          } else {
            setHandsDetected(false);
            setPhoneNearby(false);
            handsRef.current.lastResults = null;
          }
        });

        handsRef.current = hands;
      } catch (err) {
        console.error('Error loading Hands:', err);
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
            await initHands();
            await initMicrophone(); // Initialize microphone for keyboard detection
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
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        // Process face mesh
        if (faceMesh) {
          await faceMesh.send({ image: videoRef.current });
        }
        // Process hands
        if (handsRef.current) {
          await handsRef.current.send({ image: videoRef.current });
        }
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

    // Initialize logs
    addLog('System initialized', 'info');
    addLog('Starting camera...', 'info');

    // Productivity score update interval
    productivityIntervalRef.current = setInterval(() => {
      // Update current focus time if currently focused
      if (focusStartTimeRef.current && wasFocusedRef.current) {
        const currentFocusDuration = (Date.now() - focusStartTimeRef.current) / 1000;
        setCurrentFocusTime(currentFocusDuration);
      } else {
        setCurrentFocusTime(0);
      }
      const newScore = calculateProductivityScore();
      setProductivityScore(newScore);
    }, 1000);

    initCamera();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (antiCheatInterval) {
        clearInterval(antiCheatInterval);
      }
      if (productivityIntervalRef.current) {
        clearInterval(productivityIntervalRef.current);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      // Cleanup microphone
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (microphoneRef.current) {
        microphoneRef.current.disconnect();
      }
    };
  }, []);

  // Update ref when showMesh state changes
  useEffect(() => {
    showMeshRef.current = showMesh;
  }, [showMesh]);

  // Todo list functions
  const addTodo = () => {
    if (newTodo.trim()) {
      setTodos([...todos, { id: Date.now(), text: newTodo.trim(), completed: false }]);
      setNewTodo('');
    }
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo => {
      if (todo.id === id) {
        const wasCompleted = todo.completed;
        const newCompleted = !todo.completed;
        
        // Award XP when completing a todo (not when unchecking)
        if (!wasCompleted && newCompleted) {
          const textLength = todo.text.length;
          // Shorter text = smaller XP, longer text = larger XP
          // Scale multiplier based on length: shorter gets 1-2 per char, longer gets 3-6 per char
          let multiplierMin, multiplierMax;
          if (textLength <= 5) {
            // Very short: 1-2 XP per character
            multiplierMin = 1;
            multiplierMax = 2;
          } else if (textLength <= 15) {
            // Short: 2-3 XP per character
            multiplierMin = 2;
            multiplierMax = 3;
          } else if (textLength <= 30) {
            // Medium: 3-5 XP per character
            multiplierMin = 3;
            multiplierMax = 5;
          } else {
            // Long: 5-8 XP per character
            multiplierMin = 5;
            multiplierMax = 8;
          }
          
          const baseXp = textLength * (multiplierMin + Math.random() * (multiplierMax - multiplierMin));
          // Smaller random bonus for shorter text, larger for longer
          const randomBonus = Math.random() * Math.min(20, textLength * 2); // Max bonus scales with length
          const earnedXp = Math.floor(baseXp + randomBonus);
          
          setXp(prev => {
            const newXp = prev + earnedXp;
            updateLevel(newXp);
            return newXp;
          });
          
          addLog(`✨ +${earnedXp} XP for completing: "${todo.text}"`, 'success');
        }
        
        return { ...todo, completed: newCompleted };
      }
      return todo;
    }));
  };

  const handleTodoKeyPress = (e) => {
    if (e.key === 'Enter') {
      addTodo();
    }
  };

  return (
    <Box w="100%" maxW="1600px" mx="auto" p={4}>
      <Grid templateColumns={{ base: '1fr', md: '250px 1fr', lg: '250px 1fr 400px' }} gap={6}>
        {/* Left Column - Todo List */}
        <GridItem>
          <Box
            bg="white"
            borderRadius="lg"
            border="2px"
            borderColor="gray.200"
            p={4}
            h="fit-content"
            position="sticky"
            top={4}
          >
            <HStack justify="space-between" mb={3}>
              <Heading size="sm">📝 Todo List</Heading>
              <IconButton
                icon={isTodoListOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                size="sm"
                variant="ghost"
                onClick={() => setIsTodoListOpen(!isTodoListOpen)}
                aria-label="Toggle todo list"
              />
            </HStack>
            {/* XP and Level Display */}
            <Box mb={3} p={2} bg="purple.50" borderRadius="md" border="1px" borderColor="purple.200">
              <HStack justify="space-between" mb={1}>
                <Text fontSize="xs" fontWeight="bold" color="purple.700">
                  ⭐ Level {level}
                </Text>
                <Text fontSize="xs" color="purple.600">
                  {xp} / {getXpForNextLevel(level)} XP
                </Text>
              </HStack>
              <Box w="100%" h="6px" bg="purple.100" borderRadius="full" overflow="hidden">
                <Box
                  h="100%"
                  bg="purple.400"
                  borderRadius="full"
                  w={`${(() => {
                    const xpForCurrentLevel = level > 1 ? getXpForNextLevel(level - 1) : 0;
                    const xpForNextLevel = getXpForNextLevel(level);
                    const xpInCurrentLevel = xp - xpForCurrentLevel;
                    const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;
                    return Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForNext) * 100));
                  })()}%`}
                  transition="width 0.3s"
                />
              </Box>
            </Box>
            <Collapse in={isTodoListOpen} animateOpacity>
              <VStack spacing={3} align="stretch">
                {/* Add Todo Input */}
                <HStack>
                  <Input
                    placeholder="Add task..."
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    onKeyPress={handleTodoKeyPress}
                    size="sm"
                  />
                  <IconButton
                    icon={<AddIcon />}
                    size="sm"
                    colorScheme="blue"
                    onClick={addTodo}
                    aria-label="Add todo"
                  />
                </HStack>
                
                {/* Todo Items */}
                <VStack spacing={2} align="stretch" maxH="500px" overflowY="auto">
                  {todos.length === 0 ? (
                    <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
                      No tasks yet. Add one above!
                    </Text>
                  ) : (
                    todos.map(todo => (
                      <HStack
                        key={todo.id}
                        p={2}
                        bg={todo.completed ? 'gray.50' : 'white'}
                        borderRadius="md"
                        border="1px"
                        borderColor="gray.200"
                        spacing={2}
                      >
                        <Checkbox
                          isChecked={todo.completed}
                          onChange={() => toggleTodo(todo.id)}
                          colorScheme="blue"
                        />
                        <Text
                          flex={1}
                          fontSize="sm"
                          textDecoration={todo.completed ? 'line-through' : 'none'}
                          color={todo.completed ? 'gray.500' : 'gray.800'}
                        >
                          {todo.text}
                        </Text>
                        <IconButton
                          icon={<DeleteIcon />}
                          size="xs"
                          colorScheme="red"
                          variant="ghost"
                          onClick={() => deleteTodo(todo.id)}
                          aria-label="Delete todo"
                        />
                      </HStack>
                    ))
                  )}
                </VStack>
              </VStack>
            </Collapse>
          </Box>
        </GridItem>
        {/* Left Column - Main Camera */}
        <GridItem>
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

        {/* Mesh Toggles */}
        <HStack spacing={4} justify="center" flexWrap="wrap">
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
          <FormControl display="flex" alignItems="center" justifyContent="center">
            <FormLabel htmlFor="hand-mesh-toggle" mb="0" fontSize="sm">
              Show Hand Mesh
            </FormLabel>
            <Switch
              id="hand-mesh-toggle"
              isChecked={showHandMesh}
              onChange={(e) => setShowHandMesh(e.target.checked)}
              colorScheme="cyan"
            />
          </FormControl>
        </HStack>
        
        {/* Hand, Phone, and Keyboard Status */}
        <HStack spacing={4} w="100%" justify="center" flexWrap="wrap">
          {handsDetected && (
            <Badge colorScheme="cyan" fontSize="sm" px={3} py={1}>
              ✋ Hands Detected
            </Badge>
          )}
          {phoneNearby && (
            <Badge colorScheme="red" fontSize="sm" px={3} py={1}>
              📱 Phone Nearby!
            </Badge>
          )}
         
        </HStack>
        
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
        </GridItem>

        {/* Right Column - Status, Score, and Logs */}
        <GridItem>
          <VStack spacing={4} align="stretch">
            {/* Big Status Emoji */}
            <Box textAlign="center" p={6} bg={antiCheatStatus === 'suspicious' ? 'red.50' : antiCheatStatus === 'verified' ? 'green.50' : 'yellow.50'} borderRadius="lg" border="2px" borderColor={antiCheatStatus === 'suspicious' ? 'red.300' : antiCheatStatus === 'verified' ? 'green.300' : 'yellow.300'}>
              <Text fontSize="6xl" mb={2}>
                {getStatusEmoji()}
              </Text>
              <Text fontSize="lg" fontWeight="bold" color={antiCheatStatus === 'suspicious' ? 'red.600' : antiCheatStatus === 'verified' ? 'green.600' : 'yellow.600'}>
                {antiCheatStatus === 'suspicious' ? 'CHEAT DETECTED' : 
                 antiCheatStatus === 'verified' && isFocused ? 'SAFE & FOCUSED' :
                 antiCheatStatus === 'verified' ? 'SAFE' : 'VERIFYING'}
              </Text>
            </Box>

            {/* Productivity Score */}
            <Box p={4} bg="blue.50" borderRadius="lg" border="2px" borderColor="blue.300">
              <VStack spacing={2}>
                <Text fontSize="4xl">{getProductivityEmoji(productivityScore)}</Text>
                <Text fontSize="2xl" fontWeight="bold" color="blue.600">
                  Score: {Math.round(productivityScore)}/100
                </Text>
                <Text fontSize="xs" color="gray.600" textAlign="center" mt={2}>
                  <strong>How scoring works:</strong><br/>
                  • +1 point per 10 seconds of focus<br/>
                  • -10 points per cheat detection<br/>
                  • -20 points for suspicious activity<br/>
                  • Score resets to 100 at start
                </Text>
                <Divider />
                <HStack spacing={4} fontSize="xs" color="gray.600" justify="center">
                  <VStack spacing={0}>
                    <Text fontWeight="bold">Total Focus</Text>
                    <Text>{Math.floor(totalFocusTime + currentFocusTime)}s</Text>
                  </VStack>
                  <VStack spacing={0}>
                    <Text fontWeight="bold">Current Session</Text>
                    <Text>{Math.floor(currentFocusTime)}s</Text>
                  </VStack>
                  <VStack spacing={0}>
                    <Text fontWeight="bold">Focus Lost</Text>
                    <Text color={cheatDetections > 0 ? 'red.600' : 'gray.600'}>
                      {cheatDetections.toFixed(2)}
                    </Text>
                  </VStack>
                </HStack>
              </VStack>
            </Box>

            {/* Activity Logs */}
            <Box p={4} bg="gray.50" borderRadius="lg" border="1px" borderColor="gray.200" maxH="400px" overflowY="auto">
              <HStack justify="space-between" mb={3}>
                <Text fontSize="md" fontWeight="bold">
                  Activity Log
                </Text>
                {logs.length > 15 && (
                  <Text fontSize="xs" color="gray.500">
                    Showing {Math.min(15, logs.length)} of {logs.length}
                  </Text>
                )}
              </HStack>
              <VStack spacing={2} align="stretch">
                {logs.length === 0 ? (
                  <Text fontSize="sm" color="gray.400" fontStyle="italic">
                    No activity yet...
                  </Text>
                ) : (
                  logs.slice(0, 15).map((log) => (
                    <Box
                      key={log.id}
                      p={2}
                      bg={
                        log.type === 'error' ? 'red.50' :
                        log.type === 'warning' ? 'yellow.50' :
                        log.type === 'success' ? 'green.50' : 'white'
                      }
                      borderRadius="md"
                      borderLeft="3px solid"
                      borderColor={
                        log.type === 'error' ? 'red.400' :
                        log.type === 'warning' ? 'yellow.400' :
                        log.type === 'success' ? 'green.400' : 'gray.400'
                      }
                    >
                      <HStack spacing={2} fontSize="xs" color="gray.500" mb={1}>
                        <Text fontWeight="bold">{log.timestamp}</Text>
                        <Badge
                          size="sm"
                          colorScheme={
                            log.type === 'error' ? 'red' :
                            log.type === 'warning' ? 'yellow' :
                            log.type === 'success' ? 'green' : 'gray'
                          }
                        >
                          {log.type.toUpperCase()}
                        </Badge>
                      </HStack>
                      <Text fontSize="sm" color="gray.700">
                        {log.message}
                      </Text>
                    </Box>
                  ))
                )}
              </VStack>
            </Box>
          </VStack>
        </GridItem>
      </Grid>

    </Box>
  );
}
