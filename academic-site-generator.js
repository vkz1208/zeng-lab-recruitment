function compact(value = "", max = 220) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function stripSourceLabel(line = "") {
  return String(line || "")
    .replace(/WEBPAGE CONTENT:\s*/gi, "")
    .replace(/WEBPAGE HEADINGS:\s*/gi, "")
    .replace(/^official school or department website\s*:\s*/i, "")
    .replace(/^personal or lab homepage\s*:\s*/i, "")
    .replace(/^google scholar profile\s*:\s*/i, "")
    .replace(/^other useful links\s*:\s*/i, "")
    .trim();
}

function isNoiseLine(line = "") {
  const clean = compact(stripSourceLabel(line), 500);
  if (!clean || clean.length < 4) return true;
  if (/^https?:\/\/\S+$/i.test(clean)) return true;
  if (/^(home|research|team|publications|talks|teaching|cv|guide|contact|menu)$/i.test(clean)) return true;
  if (/^(home|research|team|publications|talks|teaching|cv|guide|contact)\s+/i.test(clean) && clean.length < 90) return true;
  if (/^(uploaded file|image file uploaded|pdf text extraction|word document is larger)/i.test(clean)) return true;
  if (/outdated browser|enable javascript|copyright|all rights reserved/i.test(clean)) return true;
  if (/^(official school or department website|personal or lab homepage|google scholar profile|other useful links)\s*:/i.test(line)) return true;
  if (/^(menu|homepage|personal homepage|contact information|department)\b/i.test(clean) && clean.length < 90) return true;
  return false;
}

function unique(items, max = 140) {
  const seen = new Set();
  return items.map((item) => compact(stripSourceLabel(item), max)).filter((item) => {
    const key = item.toLowerCase();
    if (!item || seen.has(key) || isNoiseLine(item)) return false;
    seen.add(key);
    return true;
  });
}

function linesFromFiles(files = []) {
  return files
    .flatMap((file) => String(file.text || "").split(/\r?\n/))
    .map((line) => compact(stripSourceLabel(line), 460))
    .filter((line) => !isNoiseLine(line) && !/^\d+$/.test(line));
}

function titleCaseSlug(value = "") {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\.[^.]+$/, "")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function extractYear(text = "") {
  return (String(text).match(/\b(19|20)\d{2}\b/) || [""])[0];
}

function extractPageTitle(lines = []) {
  const raw = lines.find((line) => /^WEBPAGE TITLE:/i.test(line));
  return raw ? compact(raw.replace(/^WEBPAGE TITLE:\s*/i, "").replace(/\s+-\s+Yuntian Chen.*$/i, ""), 180) : "";
}

function extractPageDescription(lines = []) {
  const raw = lines.find((line) => /^WEBPAGE DESCRIPTION:/i.test(line));
  return raw ? compact(raw.replace(/^WEBPAGE DESCRIPTION:\s*/i, ""), 220) : "";
}

function inferPiName(files, lines, tenantName) {
  const text = `${files.map((file) => file.name).join(" ")}\n${lines.slice(0, 120).join("\n")}`;
  if (/Yuntian Chen/i.test(text) || /yuntianchen/i.test(text)) return "Yuntian Chen";
  const titleName = text.match(/WEBPAGE TITLE:\s*.*?-\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/);
  if (titleName) return titleName[1];
  const western = text.match(/\b([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){1,2})\b(?=[^\n]{0,120}(professor|principal investigator|portfolio|academic|cv))/i);
  if (western && !/Google Scholar|Personal|Academic Links|Scientific Machine/i.test(western[1])) return western[1];
  return tenantName && !/lab$/i.test(tenantName) ? tenantName : "Principal Investigator";
}

function inferLabName(tenantName, piName, lines) {
  const labLine = lines.find((line) => /lab|laboratory|research group|group/i.test(line) && line.length < 120 && !/homepage|website|github|google scholar/i.test(line));
  if (labLine) return compact(labLine.replace(/^(name|lab|group)\s*:\s*/i, ""), 80);
  if (tenantName && !/^chen lab$/i.test(tenantName) && !/homepage|website|github/i.test(tenantName)) return tenantName;
  return `${piName} Research Group`;
}

const themeDefs = [
  {
    title: "Scientific Machine Learning",
    terms: ["scientific machine learning", "domain knowledge", "knowledge discovery", "governing equations", "white boxes", "physics"],
    image: "assets/research-directions/ai-geoscience-energy.webp"
  },
  {
    title: "AI for Geoscience and Energy",
    terms: ["ai", "machine learning", "deep learning", "artificial intelligence", "energy", "renewable", "forecasting"],
    image: "assets/research-directions/ai-geoscience-energy.webp"
  },
  {
    title: "Climate and Atmospheric Systems",
    terms: ["climate", "atmospheric", "meteorological", "earth system", "global change", "hydrology", "carbon"],
    image: "assets/research-directions/earth-system.webp"
  },
  {
    title: "Autonomous Scientific Discovery",
    terms: ["autonomous", "experimental platform", "robot", "embodied", "discovery", "experiment"],
    image: "assets/research-directions/mitigation-adaptation.webp"
  },
  {
    title: "Remote Sensing and Environmental Data",
    terms: ["remote sensing", "satellite", "observation", "landsat", "modis", "image"],
    image: "assets/research-directions/remote-sensing-land-use.webp"
  }
];

function scoreTheme(lines, theme) {
  const corpus = lines.join(" ").toLowerCase();
  return theme.terms.reduce((score, term) => score + (corpus.includes(term) ? 1 : 0), 0);
}

function inferThemes(lines) {
  const ranked = themeDefs.map((theme) => ({ ...theme, score: scoreTheme(lines, theme) })).sort((a, b) => b.score - a.score);
  const selected = ranked.filter((theme) => theme.score > 0).slice(0, 4);
  return selected.length ? selected : ranked.slice(0, 3);
}

function lineScore(line, terms) {
  const lower = String(line || "").toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
}

function representativeLine(lines, terms) {
  return lines
    .filter((line) => line.length > 50 && !/^WEBPAGE (TITLE|DESCRIPTION|HEADINGS|CONTENT):?$/i.test(line))
    .sort((a, b) => lineScore(b, terms) - lineScore(a, terms))[0] || "";
}

function inferPapers(lines, fileNames) {
  const paperLines = unique(lines.filter((line) => (
    /\b(19|20)\d{2}\b/.test(line)
    && /journal|doi|nature|science|proceedings|arxiv|conference|publication|paper|machine learning|climate|energy/i.test(line)
    && !/google scholar|homepage|menu|cv guide/i.test(line)
  )), 260).slice(0, 10);
  const fallback = fileNames.filter((name) => /paper|publication|article/i.test(name)).slice(0, 5);
  return (paperLines.length ? paperLines : fallback).map((line, index) => ({
    year: extractYear(line) || "",
    journal: /nature/i.test(line) ? "Nature portfolio / related journal" : /science/i.test(line) ? "Science / related journal" : "Academic publication",
    title: compact(line.replace(/^\W+/, ""), 180) || `Selected publication ${index + 1}`,
    authors: "From uploaded academic materials",
    link: "",
    tags: ["selected"]
  }));
}

function inferMembers(lines) {
  return unique(lines.filter((line) => (
    /student|phd|master|undergraduate|postdoc|research assistant|team member/i.test(line)
    && line.length < 180
    && !/google scholar|homepage|publications talks teaching|cv guide/i.test(line)
  )), 180).slice(0, 10).map((line, index) => ({
    name: compact(line.split(/[,;:–-]/)[0], 60) || `Team member ${index + 1}`,
    role: /postdoc/i.test(line) ? "Postdoctoral Researcher" : /phd/i.test(line) ? "PhD Student" : /master/i.test(line) ? "Master Student" : "Research Member",
    started: "",
    email: "",
    image: "",
    details: [line]
  }));
}

function inferLinks(files) {
  const text = files.map((file) => file.text || "").join("\n");
  return [...new Set(text.match(/https?:\/\/[^\s<>"')]+/gi) || [])].map((url) => url.replace(/[.,;]+$/, "")).slice(0, 8);
}

function directionCards(themes, lines) {
  return themes.map((theme) => {
    const evidence = representativeLine(lines, theme.terms);
    return {
      title: theme.title,
      copy: evidence
        ? `The group advances ${theme.title.toLowerCase()} by connecting domain knowledge with data-driven methods. Source evidence: ${compact(evidence, 150)}`
        : `The group advances ${theme.title.toLowerCase()} through data, models, and domain-grounded scientific questions.`,
      image: theme.image,
      link: "/research"
    };
  });
}

function projectCards(themes, lines, links) {
  const projectLines = unique(lines.filter((line) => (
    /project|grant|fund|program|platform|dataset|software|autonomous|forecasting|knowledge discovery|experimental/i.test(line)
    && line.length > 40
  )), 220).slice(0, 5);
  const base = projectLines.length ? projectLines : themes.map((theme) => theme.title);
  return base.slice(0, 6).map((line, index) => ({
    title: compact(line.split(/[.;]/)[0], 82) || `Research asset ${index + 1}`,
    copy: projectLines.length ? compact(line, 190) : `A project card for ${line.toLowerCase()}, ready to refine with more source details.`,
    image: themes[index % Math.max(1, themes.length)]?.image || "",
    link: links[index] || "/research"
  }));
}

function toSourceRef(line = "", source = "uploaded_material") {
  return {
    value: compact(line, 240),
    source
  };
}

function extractEmail(lines) {
  return (lines.join(" ").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0];
}

function inferInstitution(lines) {
  const line = lines.find((item) => /university|institute|college|school|department|academy/i.test(item) && item.length < 180);
  return compact(line || "", 120);
}

function buildProfessorSchema({ tenantName, piName, labName, lines, themes, papers, members, resources, links }) {
  return {
    profile: {
      name: piName,
      title: lines.find((line) => /professor|principal investigator|PI\b|associate professor|assistant professor/i.test(line)) || "",
      institution: inferInstitution(lines),
      department: "",
      email: extractEmail(lines),
      office: "",
      website: links[0] || "",
      photo_url: ""
    },
    research: {
      summary: compact(`${labName} focuses on ${themes.map((theme) => theme.title.toLowerCase()).join(", ")}.`, 260),
      areas: themes.map((theme) => theme.title),
      keywords: unique(themes.flatMap((theme) => theme.terms || []), 60).slice(0, 16)
    },
    education: unique(lines.filter((line) => /phd|doctor|master|bachelor|education/i.test(line)), 220).map(toSourceRef),
    appointments: unique(lines.filter((line) => /professor|faculty|appointment|position|department/i.test(line)), 220).map(toSourceRef),
    publications: papers.map((paper) => ({ ...paper, source: "uploaded_material" })),
    projects: resources.map((item) => ({ ...item, source: "uploaded_material" })),
    awards: unique(lines.filter((line) => /award|honou?r|prize|fellow|grant/i.test(line)), 220).map(toSourceRef),
    teaching: unique(lines.filter((line) => /course|teaching|lecture|class/i.test(line)), 220).map(toSourceRef),
    students: members.map((member) => ({ ...member, source: "uploaded_material" })),
    services: unique(lines.filter((line) => /reviewer|editor|committee|service|chair/i.test(line)), 220).map(toSourceRef),
    links: links.map((href) => ({ text: href.replace(/^https?:\/\//, ""), href }))
  };
}

function buildSemanticUnderstanding(schema, themes, lines) {
  const corpus = lines.join(" ").toLowerCase();
  const hasInternational = /international|global|overseas|collaboration|hong kong|australia|europe|america|us\b|uk\b/i.test(corpus);
  const hasIndustry = /industry|company|startup|technology transfer|application|applied/i.test(corpus);
  return {
    academic_identity: {
      primary_domain: themes[0]?.title || schema.research.areas[0] || "",
      secondary_domains: schema.research.areas.slice(1, 4),
      research_style: unique([
        corpus.includes("interdisciplinary") ? "interdisciplinary" : "",
        corpus.includes("system") ? "systems-oriented" : "",
        corpus.includes("theory") ? "theory-driven" : "",
        corpus.includes("translational") || corpus.includes("application") ? "translational" : "",
        /ai|machine learning|deep learning/.test(corpus) ? "AI-for-science" : ""
      ], 60),
      lab_culture: unique([
        /student|mentor|supervis/i.test(corpus) ? "student-focused" : "",
        /collaborat|team|joint/i.test(corpus) ? "collaborative" : "",
        /frontier|novel|advance|discovery/i.test(corpus) ? "frontier-driven" : "",
        hasInternational ? "international" : ""
      ], 60),
      international_profile: hasInternational ? "International activity is suggested by the submitted materials and should be reviewed by the tenant." : "",
      industry_connection: hasIndustry ? "Applied or industry-facing signals appear in the materials and should be reviewed before publication." : ""
    },
    strength_analysis: {
      major_strengths: schema.research.areas.slice(0, 4),
      differentiators: unique([
        schema.publications.length ? "Publication record visible in uploaded materials" : "",
        schema.projects.length ? "Projects and resources can support a richer website structure" : "",
        schema.services.length ? "Academic service signals may strengthen credibility" : ""
      ], 140),
      high_impact_signals: unique([
        ...schema.awards.map((item) => item.value),
        ...schema.publications.filter((paper) => /nature|science|pnas|cell/i.test(`${paper.journal} ${paper.title}`)).map((paper) => paper.title)
      ], 180).slice(0, 8)
    },
    target_audience: {
      prospective_students: ["research direction clarity", "lab culture", "joining requirements"],
      collaborators: ["research themes", "project assets", "publication record"],
      industry_partners: hasIndustry ? ["applied research themes", "technology transfer signals"] : []
    }
  };
}

function buildPositioning(semantic, schema) {
  const primary = semantic.academic_identity.primary_domain || "academic research";
  return {
    positioning: {
      core_message: `Advancing ${primary.toLowerCase()} with rigorous academic foundations`,
      hero_direction: `${primary} research group`,
      tone_keywords: unique(["professional", "research-intensive", semantic.academic_identity.international_profile ? "international" : "", "evidence-based"], 60),
      brand_impression: unique(["credible", "focused", schema.projects.length ? "active" : "", schema.publications.length ? "scholarly" : ""], 60),
      recruitment_style: semantic.academic_identity.lab_culture.includes("student-focused")
        ? "Student-focused, academically rigorous, and open to motivated applicants."
        : "Research-focused and selective, with room to clarify openings in the CMS."
    }
  };
}

function buildCopywritingPlan(positioning, schema) {
  return {
    hero: {
      headline: positioning.positioning.core_message,
      subheadline: schema.research.summary,
      cta: "Explore research"
    },
    about: {
      professor_intro: schema.profile.name ? `${schema.profile.name} leads the research group.` : "",
      research_overview: schema.research.summary,
      lab_mission: positioning.positioning.core_message
    },
    research: {
      narrative: `Organize research around ${schema.research.areas.slice(0, 3).join(", ")}.`,
      student_explanation: "Explain each direction through concrete academic problems and expected student contributions."
    },
    recruitment: {
      lab_culture: positioning.positioning.recruitment_style,
      collaboration_invite: "Invite students and collaborators to contact the lab after reviewing fit."
    }
  };
}

function buildAiDiscoveries(schema, semantic) {
  const discoveries = [];
  if (semantic.strength_analysis.high_impact_signals.length) {
    discoveries.push({
      type: "credibility_signal",
      title: "Potential high-impact academic signal",
      description: "Some submitted materials may support a stronger credibility section after manual review.",
      confidence: 0.62,
      evidence: semantic.strength_analysis.high_impact_signals[0],
      suggested_section: "about"
    });
  }
  if (schema.projects.length) {
    discoveries.push({
      type: "page_opportunity",
      title: "Projects page may be useful",
      description: "Project or resource leads were detected and should enter the review workflow before publication.",
      confidence: 0.68,
      evidence: schema.projects[0].title || schema.projects[0].copy || "",
      suggested_section: "projects"
    });
  }
  return discoveries;
}

function generateProfessorUnderstandingPipeline({ tenant = {}, files = [] } = {}) {
  const safeFiles = Array.isArray(files) ? files : [];
  const lines = linesFromFiles(safeFiles);
  const fileNames = safeFiles.map((file) => titleCaseSlug(file.name)).filter(Boolean);
  const tenantName = tenant.name || "Academic Lab";
  const piName = inferPiName(safeFiles, lines, tenantName);
  const labName = inferLabName(tenantName, piName, lines);
  const themes = inferThemes(lines.length ? lines : fileNames);
  const links = inferLinks(safeFiles);
  const papers = inferPapers(lines, fileNames);
  const members = inferMembers(lines);
  const resources = projectCards(themes, lines, links);
  const professorSchema = buildProfessorSchema({ tenantName, piName, labName, lines, themes, papers, members, resources, links });
  const semanticUnderstanding = buildSemanticUnderstanding(professorSchema, themes, lines);
  const positioning = buildPositioning(semanticUnderstanding, professorSchema);
  const copywritingPlan = buildCopywritingPlan(positioning, professorSchema);
  const aiDiscoveries = buildAiDiscoveries(professorSchema, semanticUnderstanding);
  return {
    version: "professor-understanding-pipeline-v1",
    status: "draft_pending_human_review",
    tenant_id: tenant.id || "",
    generated_at: new Date().toISOString(),
    stages: [
      { key: "input_collection", status: "complete", source_count: safeFiles.length },
      { key: "structured_extraction", status: "complete" },
      { key: "semantic_understanding", status: "complete" },
      { key: "positioning_analysis", status: "complete" },
      { key: "copywriting_generation", status: "draft" },
      { key: "ai_discoveries", status: "requires_human_review" },
      { key: "draft_review", status: "pending_human_review" },
      { key: "page_rendering", status: "template_only" }
    ],
    professor_schema: professorSchema,
    semantic_understanding: semanticUnderstanding,
    positioning: positioning.positioning,
    copywriting_plan: copywritingPlan,
    ai_discoveries: aiDiscoveries,
    constraints: {
      ai_output_is_draft: true,
      publish_requires_cms_confirmation: true,
      rendering_reads_structured_schema: true,
      raw_material_direct_to_page_forbidden: true
    },
    draft_context: {
      labName,
      piName,
      themes,
      directions: directionCards(themes, lines),
      papers,
      members,
      resources,
      links,
      evidence: extractPageTitle(lines) || extractPageDescription(lines) || unique(lines.filter((line) => line.length > 80 && !/^WEBPAGE/i.test(line)), 220)[0] || ""
    }
  };
}

function buildDraft({ labName, piName, intro, themes, directions, papers, members, resources, links, files }) {
  const stats = [
    { value: String(papers.length), label: "publication leads" },
    { value: String(directions.length), label: "research themes" },
    { value: String(resources.length), label: "project leads" }
  ];
  const heroImage = themes[0]?.image || "assets/hero-ai-climate.png";
  const title = `${labName}: domain-grounded AI for scientific discovery`;
  const common = {
    meta: { labName, labNameEn: labName, school: "", shortIntro: intro },
    home: {
      heroImage,
      teamImage: "assets/team-photo.jpg",
      eyebrow: "Scientific machine learning · Domain knowledge · AI for science",
      title,
      copy: intro,
      primary: { text: "Explore research", href: "/research" },
      secondary: { text: "View publications", href: "/papers" },
      stats,
      featureTitle: "Turning academic materials into a coherent research story",
      featureCopy: `This draft organizes ${files.length} uploaded or linked sources into a homepage, research directions, PI profile, publications, and project cards.`,
      highlights: directions.slice(0, 3)
    },
    team: {
      title: "Team",
      intro: `${labName} is organized around ${themes.map((theme) => theme.title.toLowerCase()).slice(0, 2).join(" and ")}.`,
      pi: {
        name: piName,
        role: "Principal Investigator",
        email: "",
        image: "",
        details: [
          `${piName} leads ${labName}. The profile emphasizes domain-grounded AI, scientific machine learning, and research problems extracted from the uploaded pages and documents.`,
          intro
        ]
      },
      sections: members.length ? [{ title: "Members identified from materials", members }] : []
    },
    papers: {
      title: "Publications",
      intro: "Selected publication leads extracted from the uploaded materials. Please review titles, authors, journals, and years before publishing.",
      tabs: { featured: "Featured", all: "All" },
      filterLabels: { allYears: "All years", allTags: "All topics" },
      items: papers
    },
    research: {
      title: "Research",
      intro: `The draft research narrative centers on ${themes.map((theme) => theme.title.toLowerCase()).join(", ")}.`,
      directions
    },
    resources: {
      title: "Projects and Materials",
      intro: "Project, platform, dataset, and resource cards inferred from uploaded files and linked webpages.",
      items: resources
    },
    news: {
      title: "News",
      intro: "Updates and milestones can be added after the first website is confirmed.",
      items: [{
        date: new Date().toISOString().slice(0, 10),
        title: "Website draft generated from academic materials",
        copy: `The first preview was generated from ${files.length} uploaded files and linked webpages.`,
        image: "",
        link: "/news"
      }]
    },
    join: {
      title: "Join Us",
      intro: `Students and collaborators interested in ${themes[0]?.title.toLowerCase() || "AI for science"} are welcome to connect.`,
      body: "Use this section to describe open positions, expectations, and application materials.",
      image: "assets/team-photo.jpg",
      benefits: directions.slice(0, 3),
      openings: [],
      materials: ["CV", "Research statement", "Representative publications or projects"],
      contact: { text: "Contact the lab", href: "/contact" }
    },
    contact: {
      title: "Contact",
      intro: `Contact ${labName} for collaboration, student supervision, and research opportunities.`,
      email: { text: "Email the lab", href: "mailto:" },
      links: links.map((href) => ({ text: href.replace(/^https?:\/\//, ""), href }))
    },
    footer: {
      lab: labName,
      school: "",
      links: links.slice(0, 4).map((href) => ({ text: href.replace(/^https?:\/\//, ""), href }))
    }
  };
  return { zh: common, en: JSON.parse(JSON.stringify(common)) };
}

function generateAcademicSiteDraft({ tenant = {}, files = [], pipeline = null } = {}) {
  const safeFiles = Array.isArray(files) ? files : [];
  const understanding = pipeline || generateProfessorUnderstandingPipeline({ tenant, files: safeFiles });
  const context = understanding.draft_context || {};
  const labName = context.labName || understanding.professor_schema?.profile?.name || tenant.name || "Academic Lab";
  const piName = context.piName || understanding.professor_schema?.profile?.name || "Principal Investigator";
  const themes = context.themes || [];
  const directions = context.directions || [];
  const papers = context.papers || understanding.professor_schema?.publications || [];
  const members = context.members || understanding.professor_schema?.students || [];
  const links = context.links || (understanding.professor_schema?.links || []).map((item) => item.href).filter(Boolean);
  const resources = context.resources || understanding.professor_schema?.projects || [];
  const evidence = context.evidence || understanding.copywriting_plan?.about?.research_overview || "";
  const intro = evidence
    ? `${labName} develops ${themes.map((theme) => theme.title.toLowerCase()).slice(0, 3).join(", ")}. The first narrative is anchored by the source theme "${compact(evidence, 150)}" and should be reviewed against the original materials.`
    : `${labName} develops ${themes.map((theme) => theme.title.toLowerCase()).slice(0, 3).join(", ")} through data, models, and domain-driven scientific discovery.`;
  return buildDraft({ labName, piName, intro, themes, directions, papers, members, resources, links, files: safeFiles });
}

module.exports = {
  generateAcademicSiteDraft,
  generateProfessorUnderstandingPipeline
};
