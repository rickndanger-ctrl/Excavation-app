import { useEffect, useState } from 'react';
import type { RockCalculatorInputs } from '../types/jobsite';
import {
  calculateCubicYards,
  formatCubicYards,
  formatFormula,
} from '../utils/rockCalculator';
import { getCalculatorInputs, saveCalculatorInputs } from '../utils/storage';

const DEFAULTS: RockCalculatorInputs = { lengthFt: 200, widthFt: 3, depthFt: 0.5 };

type RockCalculatorProps = {
  sectionRef?: React.RefObject<HTMLElement | null>;
};

export function RockCalculator({ sectionRef }: RockCalculatorProps) {
  const [inputs, setInputs] = useState<RockCalculatorInputs>(() => {
    return getCalculatorInputs() ?? DEFAULTS;
  });

  useEffect(() => {
    saveCalculatorInputs(inputs);
  }, [inputs]);

  const cubicYards = calculateCubicYards(inputs);

  const update = (field: keyof RockCalculatorInputs, value: string) => {
    const num = parseFloat(value);
    if (!Number.isNaN(num) && num >= 0) {
      setInputs((prev) => ({ ...prev, [field]: num }));
    }
  };

  return (
    <section className="rock-calculator" ref={sectionRef}>
      <h2 className="panel-heading">Rock Calculator</h2>
      <div className="rock-calculator__inputs">
        <label>
          Length (ft)
          <input
            type="number"
            min="0"
            step="1"
            value={inputs.lengthFt}
            onChange={(e) => update('lengthFt', e.target.value)}
          />
        </label>
        <span className="rock-calculator__times">×</span>
        <label>
          Width (ft)
          <input
            type="number"
            min="0"
            step="0.1"
            value={inputs.widthFt}
            onChange={(e) => update('widthFt', e.target.value)}
          />
        </label>
        <span className="rock-calculator__times">×</span>
        <label>
          Rock Depth (ft)
          <input
            type="number"
            min="0"
            step="0.1"
            value={inputs.depthFt}
            onChange={(e) => update('depthFt', e.target.value)}
          />
        </label>
      </div>
      <div className="rock-calculator__result">{formatCubicYards(cubicYards)}</div>
      <p className="rock-calculator__formula">{formatFormula(inputs)}</p>
    </section>
  );
}
