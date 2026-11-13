import React, { useState } from 'react';
import { X, Save, Sparkles, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { CareInstruction } from '../types/store';

interface EditCareInstructionModalProps {
  instruction: CareInstruction;
  onClose: () => void;
  onSave: (updated: CareInstruction) => void;
}

export const EditCareInstructionModal: React.FC<EditCareInstructionModalProps> = ({ instruction, onClose, onSave }) => {
  const [title, setTitle] = useState(instruction.title);
  const [materialCategory, setMaterialCategory] = useState(instruction.materialCategory);
  const [instructionsText, setInstructionsText] = useState(instruction.instructions.join('\n'));
  const [description, setDescription] = useState(instruction.description || '');
  const [isActive, setIsActive] = useState(instruction.isActive);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !materialCategory.trim()) return;

    const parsedInstructions = instructionsText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const updated: CareInstruction = {
      ...instruction,
      title: title.trim(),
      materialCategory: materialCategory.trim(),
      instructions: parsedInstructions.length > 0 ? parsedInstructions : ['Follow standard garment care recommendations.'],
      description: description.trim(),
      isActive,
    };
    onSave(updated);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={15} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Edit Care Instruction Template</h3>
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)' }}>Category: {instruction.materialCategory}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ marginBottom: '10px' }}>
            <div className="form-group">
              <label className="form-label">Template Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="form-input"
                placeholder="e.g. Pure Silk & Delicates"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Material Category *</label>
              <input
                type="text"
                required
                value={materialCategory}
                onChange={(e) => setMaterialCategory(e.target.value)}
                className="form-input"
                placeholder="e.g. Silk, Knitwear, Leather"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="form-label" style={{ margin: 0 }}>Care Instructions (One rule per line) *</label>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>Each line becomes a bullet point</span>
            </div>
            <textarea
              rows={5}
              required
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              className="form-textarea"
              style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8rem', lineHeight: 1.5 }}
              placeholder="Hand wash cold (below 30°C)&#10;Do not wring or twist&#10;Dry flat on clean towel&#10;Steam iron at low heat"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Overview / Guide Summary</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
              placeholder="e.g. Preserves natural luster and fibers of pure fabrics."
            />
          </div>

          <div style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', border: '1px solid var(--border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
              <span>Template Active for Product Selection</span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Save size={14} />
              <span>Save Template</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
