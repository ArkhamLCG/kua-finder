type FooterLink = {
  href: string;
  label: string;
  icon: "boosty" | "tbank" | "github" | "mail" | "telegram";
};

const DONATE_LINKS: FooterLink[] = [
  {
    href: "https://boosty.to/arkham.divider/donate",
    label: "Boosty",
    icon: "boosty",
  },
  {
    href: "https://www.tinkoff.ru/cf/1fGlAxdTumR",
    label: "Т-Банк",
    icon: "tbank",
  },
];

const CONTACT_LINKS: FooterLink[] = [
  {
    href: "https://github.com/ArkhamLCG/kua-finder",
    label: "GitHub",
    icon: "github",
  },
  {
    href: "mailto:neizerth@gmail.com",
    label: "Почта",
    icon: "mail",
  },
  {
    href: "https://t.me/neizerth",
    label: "Telegram",
    icon: "telegram",
  },
];

const ICON_SRC: Record<FooterLink["icon"], string> = {
  boosty: `${import.meta.env.BASE_URL}footer/boosty.svg`,
  tbank: `${import.meta.env.BASE_URL}footer/tbank.svg`,
  github: `${import.meta.env.BASE_URL}footer/github.svg`,
  mail: `${import.meta.env.BASE_URL}footer/mail.svg`,
  telegram: `${import.meta.env.BASE_URL}footer/telegram.svg`,
};

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer__nav" aria-label="Ссылки">
        <div className="site-footer__group">
          {DONATE_LINKS.map((link) => (
            <FooterIconLink key={link.href} link={link} />
          ))}
        </div>
        <div className="site-footer__divider" aria-hidden />
        <div className="site-footer__group">
          {CONTACT_LINKS.map((link) => (
            <FooterIconLink key={link.href} link={link} />
          ))}
        </div>
      </nav>
    </footer>
  );
}

function FooterIconLink({ link }: { link: FooterLink }) {
  return (
    <a
      className="site-footer__link"
      href={link.href}
      target="_blank"
      rel="noreferrer"
      title={link.label}
      aria-label={link.label}
    >
      <img
        className="site-footer__icon"
        src={ICON_SRC[link.icon]}
        alt=""
        width={22}
        height={22}
        loading="lazy"
        decoding="async"
      />
    </a>
  );
}
