import { Field as FieldType } from '../../../core/domain/game/Field';
import { Card } from '../card/Card';

interface FieldProps {
  field: FieldType;
}

export const Field: React.FC<FieldProps> = ({ field }) => {
  const currentPlay = field.getCurrentPlay();

  if (!currentPlay) {
    return (
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="text-white text-2xl opacity-50">場が空です</div>
      </div>
    );
  }

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
      <div className="flex flex-col items-center gap-4">
        <div className="text-white text-sm opacity-75">場のカード</div>
        <div className="flex gap-2">
          {currentPlay.cards.map((card) => (
            <Card key={card.id} card={card} />
          ))}
        </div>
      </div>
    </div>
  );
};
