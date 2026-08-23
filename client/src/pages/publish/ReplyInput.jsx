import { useState } from 'react';

export default function ReplyInput({ id, onReply }) {
    const [reply, setReply] = useState('');
    const [show, setShow] = useState(false);

    if (!show) {
        return <button className="cyber-btn cyber-btn-sm text-xs" onClick={() => setShow(true)}>回复</button>;
    }

    const handleSend = () => {
        onReply(id, reply);
        setReply('');
        setShow(false);
    };

    return (
        <div className="reply-row">
            <input className="cyber-input flex-1" value={reply}
                onChange={e => setReply(e.target.value)} placeholder="输入回复内容..." />
            <button className="cyber-btn cyber-btn-sm text-xs text-green" onClick={handleSend}>发送</button>
            <button className="cyber-btn cyber-btn-sm text-xs" onClick={() => setShow(false)}>取消</button>
        </div>
    );
}
