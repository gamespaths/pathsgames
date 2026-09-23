import Card from "@/components/layout/Card";
import { useTranslation } from "@/i18n/context";


function EndGameCard({ story, action, handleEndGamePreviewFull, handleEndGame , 
        variant="little", onBack=null , actionLabel=null, actionIcon=null }) {
    const { t } = useTranslation()
    // The board's little card says "End Game" instead of "Info"; it still opens the page first.
    const little = variant === 'little'
    return (<Card key={action.uuid} card={action.card} entityType="action" variant={variant} onClose={onBack}
        infoLabel={little ? t('game.endGame') : undefined}
        infoIconClassName={little ? 'fas fa-flag-checkered' : undefined}
        onPreview={() => handleEndGamePreviewFull({
            card: action.card,
            stats: [],
            props: {
                onAction: () => handleEndGame(action),
                actionLabel: t('game.endGame'),
                actionIcon: 'fa-flag-checkered'
            }
        })}
        onAction={() => handleEndGame(action)}
        actionLabel={ t('game.endGameShort')}  actionIcon={ 'fa-flag-checkered'}
        story={story} flagInformationCard={true}
        actionOnlyIfPreview={true} actionWithInfo={true}
    />);
}
export default EndGameCard;