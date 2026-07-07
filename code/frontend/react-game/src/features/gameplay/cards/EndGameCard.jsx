import Card from "@/components/layout/Card";
import { useTranslation } from "@/i18n/context";


function EndGameCard({ story, action, handleEndGamePreviewFull, handleEndGame , 
        variant="little", onBack=null , actionLabel=null, actionIcon=null }) {
    const { t } = useTranslation()
    return (<Card key={action.uuid} card={action.card} entityType="action" variant={variant} onClose={onBack}
        onPreview={() => 
            handleEndGamePreviewFull(action.card, action, null, [], true,
            {
                onAction: () => handleEndGame(action), 
                actionLabel: t('game.endGame'), 
                actionIcon: 'fa-flag-checkered' 
            }
        )}
        onAction={() => handleEndGame(action)}
        actionLabel={ t('game.endGameShort')}  actionIcon={ 'fa-flag-checkered'}
        story={story} flagInformationCard={true}
        actionOnlyIfPreview={true} actionWithInfo={true}
    />);
}
export default EndGameCard;