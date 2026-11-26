import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BreathCloud",
  robots: { index: false },
};

// The public site moved to its own repo (breathband-site). Where one domain
// serves both, `/` is routed to the site and this page is never seen; anywhere
// else it sends the console's own root to BreathCloud. A meta refresh rather
// than redirect(), which a static export can only carry out with JavaScript.
export default function Root() {
  return (
    <main className="container">
      <meta httpEquiv="refresh" content="0; url=/cloud/" />
      <p>
        BreathCloud is at <a href="/cloud/">/cloud/</a>.
      </p>
    </main>
  );
}
