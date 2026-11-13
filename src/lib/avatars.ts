// Фото сотрудников: имя из графика → файл в src/assets/avatars.
// Новый сотрудник: положи квадратное фото (лицо крупно, ~200×200 jpg) в папку и добавь строку сюда.
const files = import.meta.glob<string>('../assets/avatars/*.jpg', { eager: true, import: 'default', query: '?url' });
const url = (f: string) => files['../assets/avatars/' + f];

const BY_NAME: Record<string, string> = {
  'Алина Бачманова': 'alina-bachmanova.jpg',
  'Алина Татарка': 'alina-tatarka.jpg',
  'Роман': 'roman.jpg',
  'Никита': 'nikita.jpg',
  'Искандер': 'iskander.jpg',
  'Милена': 'milena.jpg',
  'Даниил': 'daniil.jpg',
  'Алим': 'alim.jpg',
  'Давлат': 'davlat.jpg',
  'Аля': 'alya.jpg',
  'Кемран': 'kemran.jpg',
  'Руслан': 'ruslan.jpg',
  'Азиз': 'aziz.jpg',
  'Мафтуна': 'maftuna.jpg',
  'Катя': 'katya.jpg',
  'Павел': 'pavel.jpg',
  'Мурат': 'murat.jpg',
};

export const avatarOf = (name: string | undefined): string | undefined => (name && BY_NAME[name] ? url(BY_NAME[name]) : undefined);
