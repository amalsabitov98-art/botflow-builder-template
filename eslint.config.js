import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // .railway — конфигурация инфраструктуры: её выполняет Railway CLI под своим
    // Node и проверяет командой `railway config plan`, правила приложения к ней не применимы.
    // .claude — копии репозитория для параллельных сессий агента: они лежат внутри
    // проекта, но проверяются в своём дереве, а не в этом.
    ignores: ["dist/**", "node_modules/**", "public/**", ".railway/**", ".claude/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "@typescript-eslint/no-floating-promises": ["error", {
        ignoreIIFE: false,
        ignoreVoid: true,
      }],
    },
  },
);
