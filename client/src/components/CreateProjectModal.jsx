import useCreateProjectState from './useCreateProjectState';
import ProjectFormFields from './ProjectFormFields';

export default function CreateProjectModal({ onClose, onCreated }) {
    const state = useCreateProjectState({ onClose, onCreated });

    return (
        <div className="cyber-modal-overlay">
            <div className="cyber-modal max-w-720 max-h-90vh" onClick={e => e.stopPropagation()}>
                <h2>{state.mode === 'template' ? '🚀 一键生成小说' : '创建新项目'}</h2>
                <ProjectFormFields state={state} onClose={onClose} />
            </div>
        </div>
    );
}
