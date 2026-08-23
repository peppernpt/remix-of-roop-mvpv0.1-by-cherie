const Footer = () => {
  const links = {
    Platform: ["Browse Stores", "How It Works", "Pricing"],
    Company: ["About", "Blog", "Careers"],
    Legal: ["Privacy", "Terms", "Cookies"],
  };

  return (
    <footer className="border-t border-muted py-16">
      <div className="container-main">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <span className="text-lg font-bold tracking-tight text-foreground uppercase">ROOP</span>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              The rental platform for modern fashion.
            </p>
          </div>
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <p className="text-sm font-semibold text-foreground mb-4">{category}</p>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-muted mt-12 pt-8">
          <p className="text-xs text-muted-foreground">© 2024 ROOP. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
