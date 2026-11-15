export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // One lowercase line: no body, no footer, no breaking-change marker.
    "body-empty": [2, "always"],
    "footer-empty": [2, "always"],
    "header-case": [2, "always", "lower-case"],
    "subject-case": [2, "always", "lower-case"],
    "subject-exclamation-mark": [2, "never"],
  },
};
