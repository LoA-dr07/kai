import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* KAI favicon – ?v=2 busts the browser cache after logo change */}
        <link rel="icon" href="/assets/favicon.png?v=2" type="image/png" />
        <link rel="apple-touch-icon" href="/assets/icon.png?v=2" />

        {/* Browser UI accent color matching the KAI dark-indigo theme */}
        <meta name="theme-color" content="#16133E" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
