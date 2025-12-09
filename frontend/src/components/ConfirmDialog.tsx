import { AlertTriangle, X } from 'lucide-react';

interface Props {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
}: Props) {
  if (!isOpen) return null;

  return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal modal-confirm" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title modal-title-warning">
                        <AlertTriangle size={20} />
                        <h2>{title}</h2>
                    </div>
                    <button className="btn-icon" onClick={onCancel}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <p>{message}</p>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
                    <button className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}