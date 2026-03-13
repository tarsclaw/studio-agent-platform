import { CATEGORY_COLOURS } from '../../lib/constants';

type Category = 'read' | 'write' | 'policy' | 'resolver';

interface CategoryBadgeProps {
  category: string;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const key = (category?.toLowerCase() as Category) || 'read';
  const colour = CATEGORY_COLOURS[key] || CATEGORY_COLOURS.read;

  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: colour.bg, color: colour.text }}
    >
      {category}
    </span>
  );
}
