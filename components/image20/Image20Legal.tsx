import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import { Image20Hero } from "@/components/image20/Image20Shared";

export function Image20LegalPage({ eyebrow, title, lead, sections }: { eyebrow: string; title: string; lead: string; sections: Array<{ title: string; body: string[] }> }) {
  return <main className="i20-root" data-image20-dom-page={`legal-${eyebrow.toLowerCase().replaceAll(' ','-')}-v6`}><Image20TopNav/><Image20Hero small eyebrow={eyebrow} title={title} lead={lead}/><section className="i20-legal-body"><div className="i20-grid two">{sections.map(s=><article className="i20-card" key={s.title}><span className="i20-kicker">Policy</span><h3>{s.title}</h3>{s.body.map((p,i)=><p key={i}>{p}</p>)}</article>)}</div></section><Image20Footer/></main>
}
