import type { CanonicalContentSnapshot } from "@testcenter-rewrite/domain";

export type FixtureReferenceEntityKind = "unit" | "booklet" | "login_collection" | "booklet_assignment";

export interface FixtureEntityReference {
  entityKind: FixtureReferenceEntityKind;
  identifier: string;
  path: string | null;
}

export interface FixtureReferenceMapping {
  mappingKey: string;
  source: FixtureEntityReference;
  canonical: FixtureEntityReference | null;
}

export interface FixtureValidationIssue {
  code: string;
  severity: "error" | "warning";
  scope: "source_package" | "source_model" | "canonical_snapshot";
  path: string | null;
  message: string;
  mappingKeys: string[];
}

export interface FixtureDescriptor {
  fixtureKey: string;
  purpose: string;
  capabilityAreas: string[];
  sourcePackageFileNames: string[];
  releaseLabel: string;
  canonicalSnapshot: CanonicalContentSnapshot;
  failureScenario?: {
    failedStage: "validate_source_model" | "validate_canonical_snapshot";
    failureMessage: string;
    validationIssues: FixtureValidationIssue[];
  };
}

export interface SourcePackageFixtureImporter {
  importerKey: string;
  matches: (input: {
    fileName: string;
    manifestHash: string;
  }) => boolean;
  fixture: FixtureDescriptor;
}

export interface ResolvedFixtureImport {
  importerKey: string;
  fixture: FixtureDescriptor;
}

export interface FixtureImportSourceManifest {
  importerKey: string;
  formatFamily: string;
  sourceSchemaVersion: string;
  fileName: string;
  manifestHash: string;
  declaredUnitKeys: string[];
  declaredBookletKeys: string[];
  declaredGroupKeys: string[];
  declaredLoginCount: number;
}

export interface FixtureImportSourceModelSummary {
  importerKey: string;
  fixtureKey: string;
  releaseLabel: string;
  unitCount: number;
  bookletCount: number;
  loginCollectionCount: number;
  groupCount: number;
  loginCount: number;
  assignmentCount: number;
  bookletKeys: string[];
  groupKeys: string[];
  assignmentKeys: string[];
}

export interface FixtureImportPipelineResult {
  importerKey: string;
  fixture: FixtureDescriptor;
  sourceManifest: FixtureImportSourceManifest;
  sourceModelSummary: FixtureImportSourceModelSummary;
  canonicalSnapshot: CanonicalContentSnapshot;
  referenceMappings: FixtureReferenceMapping[];
  failureScenario: FixtureDescriptor["failureScenario"] | null;
}

const unitMappingKey = (unitKey: string): string => `unit:${unitKey}`;

const bookletMappingKey = (bookletKey: string): string => `booklet:${bookletKey}`;

const loginCollectionMappingKey = (collectionKey: string): string => `login_collection:${collectionKey}`;

const assignmentMappingKey = (assignmentKey: string): string => `booklet_assignment:${assignmentKey}`;

export const fixtureCatalog: FixtureDescriptor[] = [
  {
    fixtureKey: "starter-and-login-baseline",
    purpose: "Validate participant entry, starter resolution, runtime policy controls, and one canonical assignment path.",
    capabilityAreas: ["participant-login", "starter", "booklet-assignment", "runtime-policy"],
    sourcePackageFileNames: ["starter-and-login-baseline.xml.zip"],
    releaseLabel: "Starter And Login Baseline",
    canonicalSnapshot: {
      fixtureKey: "starter-and-login-baseline",
      unitKeys: ["UNIT-INTRO", "UNIT-MAIN"],
      bookletDefinitions: [
        {
          bookletKey: "BOOKLET-STARTER",
          title: "Starter Baseline Booklet",
          unitKeys: ["UNIT-INTRO", "UNIT-MAIN"],
          runPolicy: {
            navigationLocked: true,
            timeLimitSeconds: 1800
          }
        }
      ],
      loginCollections: [
        {
          collectionKey: "COLLECTION-ALPHA",
          groupKey: "group-alpha",
          loginKeys: ["alpha-001"]
        }
      ],
      bookletAssignments: [
        {
          assignmentKey: "alpha-001-main",
          loginKey: "alpha-001",
          bookletKey: "BOOKLET-STARTER",
          initialStateOverrides: {
            START: "ready",
            REVIEW: "disabled"
          }
        }
      ],
      systemCheckDefinitions: [
        {
          systemCheckKey: "SC-BASELINE",
          title: "Starter Device Check",
          checkKeys: ["browser", "audio", "screen"]
        }
      ]
    }
  },
  {
    fixtureKey: "group-monitor-matrix",
    purpose: "Validate multiple groups, multiple booklets, and mixed runtime policy shapes in the canonical import model.",
    capabilityAreas: ["workspace-monitor", "multiple-booklets", "multiple-groups", "canonical-import"],
    sourcePackageFileNames: ["group-monitor-matrix.xml.zip"],
    releaseLabel: "Group Monitor Matrix",
    canonicalSnapshot: {
      fixtureKey: "group-monitor-matrix",
      unitKeys: ["UNIT-INTRO", "UNIT-MAIN", "UNIT-REVIEW", "UNIT-ALT-A", "UNIT-ALT-B"],
      bookletDefinitions: [
        {
          bookletKey: "BOOKLET-MAIN",
          title: "Main Cohort Booklet",
          unitKeys: ["UNIT-INTRO", "UNIT-MAIN", "UNIT-REVIEW"],
          runPolicy: {
            navigationLocked: true,
            timeLimitSeconds: 2700
          }
        },
        {
          bookletKey: "BOOKLET-ALT",
          title: "Alternate Cohort Booklet",
          unitKeys: ["UNIT-ALT-A", "UNIT-ALT-B"],
          runPolicy: {
            navigationLocked: false,
            timeLimitSeconds: null
          }
        }
      ],
      loginCollections: [
        {
          collectionKey: "COLLECTION-BRAVO",
          groupKey: "group-bravo",
          loginKeys: ["bravo-001", "bravo-002"]
        },
        {
          collectionKey: "COLLECTION-CHARLIE",
          groupKey: "group-charlie",
          loginKeys: ["charlie-001"]
        }
      ],
      bookletAssignments: [
        {
          assignmentKey: "bravo-001-main",
          loginKey: "bravo-001",
          bookletKey: "BOOKLET-MAIN",
          initialStateOverrides: {
            START: "ready",
            REVIEW: "enabled"
          }
        },
        {
          assignmentKey: "bravo-002-main",
          loginKey: "bravo-002",
          bookletKey: "BOOKLET-MAIN",
          initialStateOverrides: {
            START: "ready",
            REVIEW: "enabled"
          }
        },
        {
          assignmentKey: "charlie-001-alt",
          loginKey: "charlie-001",
          bookletKey: "BOOKLET-ALT",
          initialStateOverrides: {
            START: "ready",
            HELP: "enabled"
          }
        }
      ],
      systemCheckDefinitions: [
        {
          systemCheckKey: "SC-GROUP-MAIN",
          title: "Main Cohort Device Check",
          checkKeys: ["browser", "network", "audio"]
        },
        {
          systemCheckKey: "SC-GROUP-ALT",
          title: "Alternate Cohort Device Check",
          checkKeys: ["browser", "screen"]
        }
      ]
    }
  },
  {
    fixtureKey: "group-monitor-matrix-revision",
    purpose: "Validate successive imports where shared booklets, login collections, and assignments keep their keys but change field-level values.",
    capabilityAreas: ["workspace-monitor", "content-release-diff", "field-level-change-reasons"],
    sourcePackageFileNames: ["group-monitor-matrix-revision.xml.zip"],
    releaseLabel: "Group Monitor Matrix Revision",
    canonicalSnapshot: {
      fixtureKey: "group-monitor-matrix-revision",
      unitKeys: ["UNIT-INTRO", "UNIT-MAIN", "UNIT-REVIEW", "UNIT-ALT-A", "UNIT-ALT-B"],
      bookletDefinitions: [
        {
          bookletKey: "BOOKLET-MAIN",
          title: "Main Cohort Booklet Rev B",
          unitKeys: ["UNIT-INTRO", "UNIT-MAIN", "UNIT-REVIEW"],
          runPolicy: {
            navigationLocked: true,
            timeLimitSeconds: 3000
          }
        },
        {
          bookletKey: "BOOKLET-ALT",
          title: "Alternate Cohort Booklet",
          unitKeys: ["UNIT-ALT-A", "UNIT-ALT-B"],
          runPolicy: {
            navigationLocked: true,
            timeLimitSeconds: 1200
          }
        }
      ],
      loginCollections: [
        {
          collectionKey: "COLLECTION-BRAVO",
          groupKey: "group-bravo-revision",
          loginKeys: ["bravo-001", "bravo-002"]
        },
        {
          collectionKey: "COLLECTION-CHARLIE",
          groupKey: "group-charlie",
          loginKeys: ["charlie-001"]
        }
      ],
      bookletAssignments: [
        {
          assignmentKey: "bravo-001-main",
          loginKey: "bravo-001",
          bookletKey: "BOOKLET-MAIN",
          initialStateOverrides: {
            START: "ready",
            REVIEW: "enabled"
          }
        },
        {
          assignmentKey: "bravo-002-main",
          loginKey: "bravo-002",
          bookletKey: "BOOKLET-ALT",
          initialStateOverrides: {
            START: "ready",
            REVIEW: "enabled"
          }
        },
        {
          assignmentKey: "charlie-001-alt",
          loginKey: "charlie-001",
          bookletKey: "BOOKLET-ALT",
          initialStateOverrides: {
            START: "ready",
            HELP: "disabled"
          }
        }
      ],
      systemCheckDefinitions: [
        {
          systemCheckKey: "SC-GROUP-MAIN",
          title: "Main Cohort Device Check",
          checkKeys: ["browser", "network", "audio"]
        },
        {
          systemCheckKey: "SC-GROUP-ALT",
          title: "Alternate Cohort Device Check",
          checkKeys: ["browser", "screen"]
        }
      ]
    }
  },
  {
    fixtureKey: "invalid-source-model",
    purpose: "Validate importer failures at source-model validation while still exposing manifest and source-model diagnostics.",
    capabilityAreas: ["import-validation", "source-model-diagnostics"],
    sourcePackageFileNames: ["invalid-source-model.xml.zip"],
    releaseLabel: "Invalid Source Model",
    canonicalSnapshot: {
      fixtureKey: "invalid-source-model",
      unitKeys: ["UNIT-BROKEN"],
      bookletDefinitions: [
        {
          bookletKey: "BOOKLET-BROKEN",
          title: "Broken Source Model Booklet",
          unitKeys: ["UNIT-BROKEN"],
          runPolicy: {
            navigationLocked: true,
            timeLimitSeconds: null
          }
        }
      ],
      loginCollections: [
        {
          collectionKey: "COLLECTION-BROKEN",
          groupKey: "group-broken",
          loginKeys: ["broken-001"]
        }
      ],
      bookletAssignments: [
        {
          assignmentKey: "broken-001-main",
          loginKey: "broken-001",
          bookletKey: "BOOKLET-BROKEN",
          initialStateOverrides: {
            START: "ready"
          }
        }
      ],
      systemCheckDefinitions: []
    },
    failureScenario: {
      failedStage: "validate_source_model",
      failureMessage: "Source model validation failed: booklet group mapping is inconsistent for fixture 'invalid-source-model'.",
      validationIssues: [
        {
          code: "source_model.group_policy_mapping_inconsistent",
          severity: "error",
          scope: "source_model",
          path: "loginCollections[0]",
          message: "Collection 'COLLECTION-BROKEN' references a broken group policy mapping.",
          mappingKeys: [loginCollectionMappingKey("COLLECTION-BROKEN")]
        },
        {
          code: "source_model.assignment_coverage_unverified",
          severity: "error",
          scope: "source_model",
          path: "bookletAssignments",
          message: "Assignment coverage cannot be trusted until source-model normalization succeeds.",
          mappingKeys: [
            assignmentMappingKey("broken-001-main"),
            bookletMappingKey("BOOKLET-BROKEN")
          ]
        }
      ]
    }
  },
  {
    fixtureKey: "invalid-canonical-snapshot",
    purpose: "Validate importer failures at canonical validation after transformation has already produced a candidate snapshot.",
    capabilityAreas: ["import-validation", "canonical-diagnostics"],
    sourcePackageFileNames: ["invalid-canonical-snapshot.xml.zip"],
    releaseLabel: "Invalid Canonical Snapshot",
    canonicalSnapshot: {
      fixtureKey: "invalid-canonical-snapshot",
      unitKeys: ["UNIT-C1", "UNIT-C2"],
      bookletDefinitions: [
        {
          bookletKey: "BOOKLET-CANONICAL-BROKEN",
          title: "Canonical Broken Booklet",
          unitKeys: ["UNIT-C1", "UNIT-C2"],
          runPolicy: {
            navigationLocked: false,
            timeLimitSeconds: 900
          }
        }
      ],
      loginCollections: [
        {
          collectionKey: "COLLECTION-CANONICAL-BROKEN",
          groupKey: "group-canonical-broken",
          loginKeys: ["canonical-broken-001", "canonical-broken-002"]
        }
      ],
      bookletAssignments: [
        {
          assignmentKey: "canonical-broken-001-main",
          loginKey: "canonical-broken-001",
          bookletKey: "BOOKLET-CANONICAL-BROKEN",
          initialStateOverrides: {
            START: "ready"
          }
        },
        {
          assignmentKey: "canonical-broken-002-main",
          loginKey: "canonical-broken-002",
          bookletKey: "BOOKLET-CANONICAL-BROKEN",
          initialStateOverrides: {
            START: "ready"
          }
        }
      ],
      systemCheckDefinitions: []
    },
    failureScenario: {
      failedStage: "validate_canonical_snapshot",
      failureMessage: "Canonical snapshot validation failed: transformed booklet routing is inconsistent for fixture 'invalid-canonical-snapshot'.",
      validationIssues: [
        {
          code: "canonical_snapshot.booklet_routing_invalid",
          severity: "error",
          scope: "canonical_snapshot",
          path: "bookletDefinitions[0]",
          message: "Canonical booklet 'BOOKLET-CANONICAL-BROKEN' violates transformed routing constraints.",
          mappingKeys: [bookletMappingKey("BOOKLET-CANONICAL-BROKEN")]
        },
        {
          code: "canonical_snapshot.review_coverage_missing",
          severity: "error",
          scope: "canonical_snapshot",
          path: "bookletAssignments",
          message: "Canonical review coverage must be recomputed before release materialization.",
          mappingKeys: [
            assignmentMappingKey("canonical-broken-001-main"),
            assignmentMappingKey("canonical-broken-002-main")
          ]
        }
      ]
    }
  }
];

const fixtureImporters: SourcePackageFixtureImporter[] = fixtureCatalog.map(fixture => ({
  importerKey: `fixture-catalog:${fixture.fixtureKey}`,
  fixture,
  matches: input =>
    fixture.fixtureKey === input.manifestHash ||
    fixture.sourcePackageFileNames.includes(input.fileName)
}));

const buildFixtureReferenceMappings = (
  canonicalSnapshot: CanonicalContentSnapshot
): FixtureReferenceMapping[] => [
  ...canonicalSnapshot.unitKeys.map((unitKey, index) => ({
    mappingKey: unitMappingKey(unitKey),
    source: {
      entityKind: "unit" as const,
      identifier: unitKey,
      path: `units[${index}]`
    },
    canonical: {
      entityKind: "unit" as const,
      identifier: unitKey,
      path: `unitKeys[${index}]`
    }
  })),
  ...canonicalSnapshot.bookletDefinitions.map((booklet, index) => ({
    mappingKey: bookletMappingKey(booklet.bookletKey),
    source: {
      entityKind: "booklet" as const,
      identifier: booklet.bookletKey,
      path: `booklets[${index}]`
    },
    canonical: {
      entityKind: "booklet" as const,
      identifier: booklet.bookletKey,
      path: `bookletDefinitions[${index}]`
    }
  })),
  ...canonicalSnapshot.loginCollections.map((collection, index) => ({
    mappingKey: loginCollectionMappingKey(collection.collectionKey),
    source: {
      entityKind: "login_collection" as const,
      identifier: collection.collectionKey,
      path: `loginCollections[${index}]`
    },
    canonical: {
      entityKind: "login_collection" as const,
      identifier: collection.collectionKey,
      path: `loginCollections[${index}]`
    }
  })),
  ...canonicalSnapshot.bookletAssignments.map((assignment, index) => ({
    mappingKey: assignmentMappingKey(assignment.assignmentKey),
    source: {
      entityKind: "booklet_assignment" as const,
      identifier: assignment.assignmentKey,
      path: `bookletAssignments[${index}]`
    },
    canonical: {
      entityKind: "booklet_assignment" as const,
      identifier: assignment.assignmentKey,
      path: `bookletAssignments[${index}]`
    }
  }))
];

export const resolveFixtureImportBySourcePackage = (
  fileName: string,
  manifestHash: string
): ResolvedFixtureImport | undefined => {
  const importer = fixtureImporters.find(candidate =>
    candidate.matches({
      fileName,
      manifestHash
    })
  );

  if (!importer) {
    return undefined;
  }

  return {
    importerKey: importer.importerKey,
    fixture: importer.fixture
  };
};

export const runFixtureImportPipeline = (
  fileName: string,
  manifestHash: string
): FixtureImportPipelineResult | undefined => {
  const resolvedImport = resolveFixtureImportBySourcePackage(fileName, manifestHash);

  if (!resolvedImport) {
    return undefined;
  }

  const { importerKey, fixture } = resolvedImport;
  const referenceMappings = buildFixtureReferenceMappings(fixture.canonicalSnapshot);
  const declaredGroupKeys = fixture.canonicalSnapshot.loginCollections.map(collection => collection.groupKey);
  const declaredBookletKeys = fixture.canonicalSnapshot.bookletDefinitions.map(booklet => booklet.bookletKey);
  const declaredLoginCount = fixture.canonicalSnapshot.loginCollections.reduce(
    (count, collection) => count + collection.loginKeys.length,
    0
  );

  return {
    importerKey,
    fixture,
    sourceManifest: {
      importerKey,
      formatFamily: "xml-archive",
      sourceSchemaVersion: "1.0",
      fileName,
      manifestHash,
      declaredUnitKeys: fixture.canonicalSnapshot.unitKeys,
      declaredBookletKeys,
      declaredGroupKeys,
      declaredLoginCount
    },
    sourceModelSummary: {
      importerKey,
      fixtureKey: fixture.fixtureKey,
      releaseLabel: fixture.releaseLabel,
      unitCount: fixture.canonicalSnapshot.unitKeys.length,
      bookletCount: fixture.canonicalSnapshot.bookletDefinitions.length,
      loginCollectionCount: fixture.canonicalSnapshot.loginCollections.length,
      groupCount: declaredGroupKeys.length,
      loginCount: declaredLoginCount,
      assignmentCount: fixture.canonicalSnapshot.bookletAssignments.length,
      bookletKeys: declaredBookletKeys,
      groupKeys: declaredGroupKeys,
      assignmentKeys: fixture.canonicalSnapshot.bookletAssignments.map(assignment => assignment.assignmentKey)
    },
    canonicalSnapshot: fixture.canonicalSnapshot,
    referenceMappings,
    failureScenario: fixture.failureScenario ?? null
  };
};
