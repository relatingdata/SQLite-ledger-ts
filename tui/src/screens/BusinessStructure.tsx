// A thin step-switcher over the three real steps the web app's own
// Business Structure popup wizard has (BusinessStructurePopup.svelte's
// STEPS array) — Org Chart (Locations/Divisions/Departments/
// Employees), Item Categories, and Other Hierarchies. The web app
// moves between them with Back/Next buttons; this TUI reuses ←/→,
// since every other arrow key is already claimed (↑/↓ move within a
// list). Escape on a step's own top-level view moves back a step,
// exactly like the web wizard's own "Back" — and, on the first step,
// leaves this screen entirely, back to the menu.
import React, { useState } from 'react';
import { useInput } from 'ink';
import { OrgChart } from './OrgChart.js';
import { ItemCategories } from './ItemCategories.js';
import { OtherHierarchies } from './OtherHierarchies.js';

const STEPS = ['org-chart', 'categories', 'hierarchies'] as const;

export function BusinessStructure({ businessName, onBack }: { businessName: string; onBack: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);

  useInput((_input, key) => {
    if (key.rightArrow) setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    if (key.leftArrow) setStepIndex((i) => Math.max(i - 1, 0));
  });

  function onStepBack() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
    else onBack();
  }

  const step = STEPS[stepIndex];
  if (step === 'categories') return <ItemCategories businessName={businessName} onBack={onStepBack} />;
  if (step === 'hierarchies') return <OtherHierarchies businessName={businessName} onBack={onStepBack} />;
  return <OrgChart businessName={businessName} onBack={onStepBack} />;
}
