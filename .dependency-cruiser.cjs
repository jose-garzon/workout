/**
 * dependency-cruiser — architecture firewall, the graph-shaped rules Biome
 * cannot express (design.md §3, ADR-4).
 *
 *   RULE 3  cross-feature imports are barrel-only: from outside a feature, only
 *           modules/<feature>/index.ts is importable — never a deep path into
 *           another feature's ui/ logic/ api/ types.
 *   +       no import cycles anywhere (no-circular).
 *
 * Runs on the Husky pre-commit hook alongside `biome check`; a violating commit
 * is blocked locally. Invoked as `depcruise src`.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment:
        "This dependency is part of a circular relationship. The cross-feature graph is acyclic by design (A<-B<-D<-C); a cycle is a design smell — break it.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "cross-feature-barrel-only",
      comment:
        "A module reached into another feature's internals (ui/logic/api/types) instead of its public index.ts barrel. Import cross-feature only via '@/modules/<feature>'.",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/" },
      to: {
        path: "^src/modules/([^/]+)/(ui|logic|api|types)",
        pathNot: "^src/modules/$1/",
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    },
  },
};
