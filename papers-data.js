window.PAPER_LIST = [];

window.loadPaperList = async function loadPaperList() {
  if (Array.isArray(window.PAPER_LIST) && window.PAPER_LIST.length) return window.PAPER_LIST;
  try {
    const response = await fetch("data/papers.json", { cache: "no-store" });
    if (!response.ok) return window.PAPER_LIST;
    const papers = await response.json();
    window.PAPER_LIST = Array.isArray(papers) ? papers : [];
  } catch {
    window.PAPER_LIST = Array.isArray(window.PAPER_LIST) ? window.PAPER_LIST : [];
  }
  return window.PAPER_LIST;
};
