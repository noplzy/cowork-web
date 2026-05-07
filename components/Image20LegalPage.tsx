import { Image20PageShell } from "@/components/Image20PageShell";

export function Image20LegalPage({
  pageName,
  eyebrow,
  title,
  lead,
  sections,
}: {
  pageName: string;
  eyebrow: string;
  title: string;
  lead: string;
  sections: { title: string; body: string[] }[];
}) {
  return (
    <Image20PageShell
      pageName={pageName}
      eyebrow={eyebrow}
      title={title}
      lead={lead}
      heroImage="/site-assets/image20/hero/brand-hero-evening-shared-presence.png"
    >
      <article className="image20-legal">
        {sections.map((section) => (
          <section key={section.title} className="image20-legal__section">
            <h2>{section.title}</h2>
            {section.body.map((paragraph, index) => (
              <p key={`${section.title}-${index}`}>{paragraph}</p>
            ))}
          </section>
        ))}
      </article>
    </Image20PageShell>
  );
}
