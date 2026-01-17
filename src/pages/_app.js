import "@/styles/globals.css";
import { ChakraProvider } from "@chakra-ui/react";
// Optional: Import your custom theme
// import { theme } from "@/theme";

export default function App({ Component, pageProps }) {
  return (
    <ChakraProvider>
      {/* To use custom theme: <ChakraProvider theme={theme}> */}
      <Component {...pageProps} />
    </ChakraProvider>
  );
}
