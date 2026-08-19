import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Branch Commerce",
    short_name: "Branch",
    description: "Gestão financeira, estoque e operação de e-commerce.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f7f1",
    theme_color: "#f6f7f1",
    orientation: "any",
    lang: "pt-BR",
    categories: ["business", "finance", "productivity"],
    icons: [
      {
        src: "/branch_logo.jpeg",
        sizes: "640x640",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
  }
}
