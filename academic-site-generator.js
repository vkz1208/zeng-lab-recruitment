function compact(value = "", max = 220) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function unique(items) {
  return [...new Set(items.map((item) => compact(item, 140)).filter(Boolean))];
}

function extractLines(files = []) {
  return files
    .flatMap((file) => String(file.text || "").split(/\r?\n/).map((line) => compact(line, 300)))
    .filter((line) => line.length > 3);
}

function titleCaseSlug(value = "") {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\.[^.]+$/, "")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function looksLikePaper(line) {
  return /doi|journal|proceedings|nature|science|remote sensing|climate|environment|water|carbon|\b20\d{2}\b/i.test(line)
    && line.length > 24;
}

function looksLikePerson(line) {
  return /student|phd|master|undergraduate|postdoc|professor|research assistant|博士|硕士|本科|学生|导师|教授|助理/i.test(line)
    && line.length < 180;
}

function looksLikeProject(line) {
  return /project|grant|fund|nsfc|national|课题|项目|基金|资助|研究方向/i.test(line)
    && line.length > 12;
}

function extractYear(text = "") {
  return (String(text).match(/\b(19|20)\d{2}\b/) || [""])[0];
}

function paperFromLine(line, index) {
  const year = extractYear(line) || String(new Date().getFullYear());
  const cleaned = line.replace(/\s+/g, " ").trim();
  const title = cleaned
    .replace(/^\W+/, "")
    .replace(/\bdoi\s*[:：].*$/i, "")
    .slice(0, 180);
  return {
    year,
    journal: /nature/i.test(line) ? "Nature portfolio / related journal" : /science/i.test(line) ? "Science / related journal" : "Academic publication",
    title: title || `Selected publication ${index + 1}`,
    authors: "Uploaded academic profile",
    link: "",
    tags: ["uploaded"]
  };
}

function memberFromLine(line, index) {
  const name = line.split(/[,，;；|-]/)[0].trim() || `Team member ${index + 1}`;
  return {
    name,
    role: /postdoc|博士后/i.test(line) ? "Postdoctoral Researcher" : /phd|博士/i.test(line) ? "PhD Student" : /master|硕士/i.test(line) ? "Master Student" : "Research Member",
    started: "",
    email: "",
    image: "",
    details: [line]
  };
}

function directionFromLine(line, index) {
  const title = line.replace(/^[-*\d.\s]+/, "").split(/[：:。.;；]/)[0].slice(0, 60) || `Research direction ${index + 1}`;
  return {
    title,
    copy: compact(line, 180),
    image: "",
    link: "/research"
  };
}

function generateAcademicSiteDraft({ tenant = {}, files = [] }) {
  const lines = extractLines(files);
  const fileNames = files.map((file) => titleCaseSlug(file.name)).filter(Boolean);
  const tenantName = tenant.name || "Academic Lab";
  const summarySeed = compact(lines.find((line) => line.length > 80) || lines[0] || `${tenantName} academic website`, 240);
  const paperLines = unique(lines.filter(looksLikePaper)).slice(0, 12);
  const memberLines = unique(lines.filter(looksLikePerson)).slice(0, 12);
  const projectLines = unique(lines.filter(looksLikeProject)).slice(0, 6);
  const fallbackDirections = unique([...projectLines, ...fileNames]).slice(0, 6);
  const directions = (fallbackDirections.length ? fallbackDirections : [
    "Interdisciplinary research generated from uploaded academic materials",
    "Student training, publications, projects, and scholarly collaboration"
  ]).map(directionFromLine);

  const papers = (paperLines.length ? paperLines : fileNames.filter((name) => /paper|publication|论文|成果/i.test(name))).slice(0, 12).map(paperFromLine);
  const members = memberLines.slice(0, 12).map(memberFromLine);
  const projectCards = (projectLines.length ? projectLines : fileNames).slice(0, 6).map((line, index) => ({
    title: compact(line.split(/[：:。.;；]/)[0], 80) || `Academic item ${index + 1}`,
    copy: compact(line, 180) || "Generated from uploaded academic material.",
    image: "",
    link: "/research"
  }));

  return {
    zh: {
      meta: {
        labName: tenantName,
        labNameEn: tenantName,
        shortIntro: summarySeed || `${tenantName} 的学术主页初稿。`
      },
      home: {
        eyebrow: "AI initialized academic website",
        title: tenantName,
        copy: summarySeed || "这是根据上传的简历、论文、学生和项目信息生成的学术官网初稿。",
        stats: [
          { value: String(papers.length), label: "识别出的论文/成果线索" },
          { value: String(members.length), label: "识别出的团队成员线索" },
          { value: String(projectCards.length), label: "识别出的项目/方向线索" }
        ],
        highlights: directions.slice(0, 3)
      },
      team: {
        title: "团队",
        pi: {
          name: tenantName,
          role: "Principal Investigator",
          email: "",
          image: "",
          details: [summarySeed || "请在后台补充 PI 简介。"]
        },
        sections: members.length ? [{ title: "Members from uploaded files", members }] : undefined
      },
      papers: {
        title: "论文",
        items: papers
      },
      research: {
        title: "研究方向",
        directions
      },
      resources: {
        title: "项目与资料",
        items: projectCards
      },
      news: {
        title: "新闻",
        items: [{
          date: new Date().toISOString().slice(0, 10),
          title: "Academic website initialized",
          copy: `已根据 ${files.length} 个上传文件生成网站初稿。`,
          image: "",
          link: "/news"
        }]
      }
    },
    en: {
      meta: {
        labName: tenantName,
        labNameEn: tenantName,
        shortIntro: summarySeed || `${tenantName} academic website draft.`
      },
      home: {
        eyebrow: "AI initialized academic website",
        title: tenantName,
        copy: summarySeed || "This academic website draft was generated from uploaded CV, publications, students, and project materials.",
        stats: [
          { value: String(papers.length), label: "Publication clues" },
          { value: String(members.length), label: "Team member clues" },
          { value: String(projectCards.length), label: "Project clues" }
        ],
        highlights: directions.slice(0, 3)
      },
      team: {
        title: "Team",
        pi: {
          name: tenantName,
          role: "Principal Investigator",
          email: "",
          image: "",
          details: [summarySeed || "Please complete the PI profile in the admin editor."]
        },
        sections: members.length ? [{ title: "Members from uploaded files", members }] : undefined
      },
      papers: {
        title: "Publications",
        items: papers
      },
      research: {
        title: "Research",
        directions
      },
      resources: {
        title: "Projects and Materials",
        items: projectCards
      },
      news: {
        title: "News",
        items: [{
          date: new Date().toISOString().slice(0, 10),
          title: "Academic website initialized",
          copy: `A first website draft was generated from ${files.length} uploaded files.`,
          image: "",
          link: "/news"
        }]
      }
    }
  };
}

module.exports = {
  generateAcademicSiteDraft
};
