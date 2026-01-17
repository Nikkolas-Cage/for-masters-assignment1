import Head from "next/head";
import { Box, Container } from "@chakra-ui/react";
import FocusCamera from "@/components/FocusCamera";

export default function Home() {
  return (
    <>
      <Head>
        <title>Focus Detection Camera</title>
        <meta name="description" content="Facial recognition camera that detects focus" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Box minH="100vh" py={8} bg="gray.50">
        <Container maxW="container.xl">
          <FocusCamera />
        </Container>
      </Box>
    </>
  );
}
