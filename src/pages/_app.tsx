import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/contexts/ThemeContext"

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <SessionProvider session={pageProps.session}>
        <Component {...pageProps} />
      </SessionProvider>
    </ThemeProvider>
  );
}
