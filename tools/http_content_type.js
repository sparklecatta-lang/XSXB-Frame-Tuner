"use strict";

const UTF8_TEXT_TYPES = [
  /^text\//i,
  /^application\/(?:json|javascript|xml|xhtml\+xml|svg\+xml)(?:\s*;|$)/i,
];

function withUtf8Charset(contentType = "application/json") {
  const value = String(contentType || "application/json").trim();
  if (/;\s*charset=/i.test(value)) return value;
  return UTF8_TEXT_TYPES.some((pattern) => pattern.test(value))
    ? `${value}; charset=utf-8`
    : value;
}

module.exports = { withUtf8Charset };
