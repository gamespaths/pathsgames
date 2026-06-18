import Card from "@/components/layout/Card";
import { useTranslation } from "@/i18n/context";


function EndGameCard({ story, action, handleSelectionPreview, handleEndGame}) {
    const { t } = useTranslation()
    return (<Card key={action.uuid} card={action.card} entityType="action"
                    onPreview={() => handleSelectionPreview(action.card, 'action')}
                    onAction={() => handleEndGame(action)}
                    actionLabel={t('game.endGame')} actionIcon={'fa-flag-checkered'}
                    story={story} flagInformationCard={true}
                    actionOnlyIfPreview={true} actionWithInfo={true}
            />);
}
export default EndGameCard;