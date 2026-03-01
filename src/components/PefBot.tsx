const PEFBOT_URL = 'https://reis-mendelu.github.io/reis-data/pefbot.html';

interface PefBotProps {
    visible: boolean;
}

export function PefBot({ visible }: PefBotProps) {
    return (
        <iframe
            src={PEFBOT_URL}
            title="PEFbot"
            className="fixed bottom-4 right-4 z-50 border-none"
            style={{
                display: visible ? 'block' : 'none',
                width: '400px',
                height: '500px',
            }}
            allow="microphone"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
    );
}
