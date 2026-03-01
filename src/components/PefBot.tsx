import { useState, useEffect, useRef } from 'react';

const PEFBOT_URL = 'https://reis-mendelu.github.io/reis-data/pefbot.html';

interface PefBotProps {
    visible: boolean;
}

export function PefBot({ visible }: PefBotProps) {
    const [chatOpen, setChatOpen] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const handle = (e: MessageEvent) => {
            if (e.data?.type === 'PEFBOT_STATE') {
                console.log('[PefBot] state from iframe:', e.data.state);
                setChatOpen(e.data.state === 'open');
            }
        };
        window.addEventListener('message', handle);
        return () => window.removeEventListener('message', handle);
    }, []);

    const size = chatOpen
        ? { width: '400px', height: '550px' }
        : { width: '70px', height: '70px' };

    console.log('[PefBot] render, visible:', visible, 'chatOpen:', chatOpen);

    return (
        <iframe
            ref={iframeRef}
            src={PEFBOT_URL}
            title="PEFbot"
            className="fixed bottom-4 right-4 z-50 border-none"
            style={{
                display: visible ? 'block' : 'none',
                width: size.width,
                height: size.height,
                background: 'transparent',
                colorScheme: 'normal',
            }}
            allow="microphone"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
    );
}
