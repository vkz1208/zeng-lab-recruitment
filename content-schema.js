const LOCALES = ["zh", "en"];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasText(object, key) {
  return typeof object?.[key] === "string" && object[key].trim().length > 0;
}

function isOptionalText(object, key) {
  return object?.[key] == null || typeof object[key] === "string";
}

function isLink(value) {
  if (value == null || value === "") return true;
  if (typeof value !== "string") return false;
  return /^(https?:\/\/|mailto:|\/|#)/.test(value);
}

function validateCards(items, path, errors, fields = ["title", "copy"]) {
  if (!Array.isArray(items)) {
    errors.push(`${path} must be an array`);
    return;
  }
  items.forEach((item, index) => {
    if (!isPlainObject(item)) {
      errors.push(`${path}.${index} must be an object`);
      return;
    }
    fields.forEach((field) => {
      if (!hasText(item, field)) errors.push(`${path}.${index}.${field} must be a non-empty string`);
    });
    if (!isOptionalText(item, "image")) errors.push(`${path}.${index}.image must be a string when present`);
    if (!isLink(item.link)) errors.push(`${path}.${index}.link has an unsupported URL format`);
  });
}

function validatePaperItems(items, path, errors) {
  if (!Array.isArray(items)) {
    errors.push(`${path} must be an array`);
    return;
  }
  items.forEach((item, index) => {
    if (!isPlainObject(item)) {
      errors.push(`${path}.${index} must be an object`);
      return;
    }
    ["year", "journal", "title", "authors"].forEach((field) => {
      if (!hasText(item, field)) errors.push(`${path}.${index}.${field} must be a non-empty string`);
    });
    if (!isLink(item.link)) errors.push(`${path}.${index}.link has an unsupported URL format`);
    if (item.tags != null && !Array.isArray(item.tags)) errors.push(`${path}.${index}.tags must be an array when present`);
  });
}

function validateContentData(data) {
  const errors = [];
  if (!isPlainObject(data)) return { valid: false, errors: ["content must be an object"] };
  if (Object.keys(data).length === 0) return { valid: true, errors };

  LOCALES.forEach((locale) => {
    const section = data[locale];
    if (section == null) return;
    if (!isPlainObject(section)) {
      errors.push(`${locale} must be an object`);
      return;
    }

    if (section.meta != null && !isPlainObject(section.meta)) errors.push(`${locale}.meta must be an object`);
    if (section.nav != null && !Array.isArray(section.nav)) errors.push(`${locale}.nav must be an array`);
    if (section.home != null && !isPlainObject(section.home)) errors.push(`${locale}.home must be an object`);
    if (section.team != null && !isPlainObject(section.team)) errors.push(`${locale}.team must be an object`);
    if (section.papers != null) {
      if (!isPlainObject(section.papers)) {
        errors.push(`${locale}.papers must be an object`);
      } else if (section.papers.items != null) {
        validatePaperItems(section.papers.items, `${locale}.papers.items`, errors);
      }
    }
    if (section.research?.directions != null) validateCards(section.research.directions, `${locale}.research.directions`, errors);
    if (section.resources?.items != null) validateCards(section.resources.items, `${locale}.resources.items`, errors);
    if (section.news?.items != null) validateCards(section.news.items, `${locale}.news.items`, errors, ["date", "title", "copy"]);
    if (section.join?.materials != null && !Array.isArray(section.join.materials)) errors.push(`${locale}.join.materials must be an array`);
    if (section.contact != null && !isPlainObject(section.contact)) errors.push(`${locale}.contact must be an object`);
  });

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateContentData
};
