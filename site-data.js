window.DEFAULT_SITE_DATA = { zh: {}, en: {} };

window.loadDefaultSiteData = async function loadDefaultSiteData() {
  if (window.DEFAULT_SITE_DATA?.zh?.meta && window.DEFAULT_SITE_DATA?.en?.meta) return window.DEFAULT_SITE_DATA;
  try {
    const response = await fetch("data/site-defaults.json", { cache: "no-store" });
    if (!response.ok) return window.DEFAULT_SITE_DATA;
    const data = await response.json();
    window.DEFAULT_SITE_DATA = {
      zh: data && typeof data.zh === "object" ? data.zh : {},
      en: data && typeof data.en === "object" ? data.en : {}
    };
  } catch {
    window.DEFAULT_SITE_DATA = window.DEFAULT_SITE_DATA || { zh: {}, en: {} };
  }
  return window.DEFAULT_SITE_DATA;
};
