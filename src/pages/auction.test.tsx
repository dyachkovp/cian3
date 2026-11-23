import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';
import { money as formatMoney } from '@/data/listings';

const money = (value: number) => formatMoney(value).replace(/\s/g, ' ');
function openAuction(path = '/auction/apartment') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
async function openSeller() {
  await userEvent.click(screen.getByRole('link', { name: 'Мои объявления' }));
}
async function openBuyer() {
  await userEvent.click(
    within(screen.getByRole('navigation', { name: 'Разделы Циана' })).getByRole('link', {
      name: 'Главная',
    }),
  );
  await userEvent.click(screen.getByRole('link', { name: /Открыть квартиру/ }));
}
async function setupAuction() {
  await openSeller();
  await userEvent.click(screen.getByRole('button', { name: /Продать на\sаукционе/ }));
}
async function publishAuction() {
  await setupAuction();
  await userEvent.click(screen.getByRole('button', { name: 'Проверить условия' }));
  await userEvent.click(screen.getByRole('button', { name: 'Опубликовать аукцион' }));
  await userEvent.click(screen.getByRole('button', { name: 'Посмотреть объявление' }));
}
async function openDemo() {
  await userEvent.click(screen.getByText('Демо-состояния', { exact: true }));
}

describe('Auction scenario', () => {
  it('starts at Cian home and follows the native placement choices', async () => {
    openAuction('/auction');
    expect(screen.getByRole('heading', { name: 'Могут подойти' })).toBeVisible();
    await userEvent.click(screen.getByRole('link', { name: 'Разместить' }));
    expect(screen.getByRole('heading', { name: 'Новое объявление' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Продажа' }));
    await userEvent.click(screen.getByRole('button', { name: 'Жилая' }));
    await userEvent.click(screen.getByRole('button', { name: 'Предыдущий шаг' }));
    expect(screen.getByRole('heading', { name: 'Продажа' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Жилая' }));
    await userEvent.click(screen.getByRole('button', { name: 'Квартира' }));
    await userEvent.click(screen.getByRole('button', { name: /Продать на\sаукционе/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Проверить условия' }));
    await userEvent.click(screen.getByRole('button', { name: 'Опубликовать аукцион' }));
    await openBuyer();
    expect(screen.getByLabelText('Ваша ставка, ₽')).toBeVisible();
  });

  it('opens the buyer view directly and lets the owner enter through My listings', async () => {
    openAuction();
    expect(screen.getByRole('heading', { name: /Светлая квартира у\sпарка/ })).toBeVisible();
    expect(screen.getByLabelText('Ваша ставка, ₽')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'В начало прототипа' })).not.toBeInTheDocument();
    await setupAuction();
    expect(screen.getByRole('heading', { name: 'Настройте аукцион' })).toBeVisible();
  });

  it('lets an owner configure, review, and publish the same auction the buyer sees', async () => {
    openAuction('/auction/seller');
    await userEvent.click(screen.getByRole('button', { name: /Продать на\sаукционе/ }));
    await userEvent.clear(screen.getByLabelText('Стартовая цена, ₽'));
    await userEvent.type(screen.getByLabelText('Стартовая цена, ₽'), '25000000');
    await userEvent.clear(screen.getByLabelText('Минимальный шаг, ₽'));
    await userEvent.type(screen.getByLabelText('Минимальный шаг, ₽'), '250000');
    await userEvent.clear(screen.getByLabelText('Дата и время окончания'));
    await userEvent.type(screen.getByLabelText('Дата и время окончания'), '2027-02-15T18:30');
    await userEvent.click(screen.getByRole('button', { name: 'Проверить условия' }));
    await openBuyer();
    await openSeller();
    expect(screen.getByRole('heading', { name: 'Проверьте условия' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Опубликовать аукцион' }));
    expect(screen.getByText('Аукцион опубликован')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Посмотреть объявление' }));
    expect(screen.getAllByText(money(25_000_000)).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(money(250_000)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^15 февраля/)[0]).toHaveTextContent('18:30');
    await userEvent.type(screen.getByLabelText('Ваша ставка, ₽'), '25500000');
    await openSeller();
    await openBuyer();
    expect(screen.getByLabelText('Ваша ставка, ₽')).toHaveValue('25500000');
    await userEvent.click(screen.getByRole('button', { name: 'Сделать ставку' }));
    expect(screen.getByRole('button', { name: /Отправляем ставку/ })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await openSeller();
    await waitFor(() => expect(screen.getByText(money(25_500_000))).toBeVisible());
    expect(screen.getByRole('button', { name: 'Изменить условия' })).toBeDisabled();
    await openBuyer();
    expect(screen.getByText('Ставка принята')).toBeVisible();
    expect(screen.getByText(`Следующая ставка — от ${money(25_750_000)}`)).toBeVisible();
  });

  it('validates a low bid and retains the amount after a response error and retry', async () => {
    openAuction();
    await userEvent.type(screen.getByLabelText('Ваша ставка, ₽'), '19800000');
    await userEvent.click(screen.getByRole('button', { name: 'Сделать ставку' }));
    expect(screen.getByText(`Минимальная ставка — ${money(19_900_000)}`)).toBeVisible();
    await userEvent.clear(screen.getByLabelText('Ваша ставка, ₽'));
    await userEvent.type(screen.getByLabelText('Ваша ставка, ₽'), '20200000');
    await openDemo();
    await userEvent.click(screen.getByRole('button', { name: 'Показать ошибку ответа' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось отправить ставку');
    await openSeller();
    expect(screen.getByText(money(19_900_000))).toBeVisible();
    await openBuyer();
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByLabelText('Ваша ставка, ₽')).toHaveValue('20200000');
    expect(screen.queryByRole('button', { name: 'Сделать ставку' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    await waitFor(() => expect(screen.getByText('Ставка принята')).toBeVisible());
    expect(screen.getAllByText(money(20_200_000))).toHaveLength(2);
  });

  it('preserves invalid seller drafts while moving between native sections', async () => {
    openAuction();
    await setupAuction();
    await userEvent.clear(screen.getByLabelText('Стартовая цена, ₽'));
    await userEvent.type(screen.getByLabelText('Стартовая цена, ₽'), '123');
    await userEvent.clear(screen.getByLabelText('Дата и время окончания'));
    await userEvent.click(screen.getByRole('button', { name: 'Проверить условия' }));
    await openBuyer();
    await openSeller();
    expect(screen.getByLabelText('Стартовая цена, ₽')).toHaveValue('123');
    expect(screen.getByText('Укажите цену от 1 000 000 ₽')).toBeVisible();
    expect(screen.getByText('Выберите дату окончания')).toBeVisible();
  });

  it('rejects a past deadline and focuses the invalid field', async () => {
    openAuction('/auction/seller');
    await userEvent.click(screen.getByRole('button', { name: /Продать на\sаукционе/ }));
    const deadline = screen.getByLabelText('Дата и время окончания');
    await userEvent.clear(deadline);
    await userEvent.type(deadline, '2020-01-01T18:30');
    await userEvent.click(screen.getByRole('button', { name: 'Проверить условия' }));
    expect(screen.getByText('Выберите дату и время в будущем')).toBeVisible();
    expect(deadline).toHaveFocus();
    expect(deadline).toHaveAccessibleDescription(/Выберите дату и\sвремя в\sбудущем/);
  });

  it('shows the actual winning bid and retains completion for both roles', async () => {
    openAuction();
    await publishAuction();
    await userEvent.type(screen.getByLabelText('Ваша ставка, ₽'), '21000000');
    await userEvent.click(screen.getByRole('button', { name: 'Сделать ставку' }));
    await waitFor(() => expect(screen.getByText('Ставка принята')).toBeVisible());
    await openDemo();
    await userEvent.click(screen.getByRole('button', { name: 'Показать завершённый аукцион' }));
    expect(screen.getByText(/Победила ставка/)).toHaveTextContent(money(21_000_000));
    expect(screen.queryByRole('button', { name: 'Сделать ставку' })).not.toBeInTheDocument();
    await openSeller();
    expect(screen.getByText('Аукцион завершён')).toBeVisible();
    await openBuyer();
    expect(screen.getByRole('heading', { name: 'Аукцион завершён' })).toBeVisible();
  });

  it('cancels a pending bid when the demo auction ends', async () => {
    openAuction();
    await userEvent.type(screen.getByLabelText('Ваша ставка, ₽'), '21000000');
    await userEvent.click(screen.getByRole('button', { name: 'Сделать ставку' }));
    await openDemo();
    await userEvent.click(screen.getByRole('button', { name: 'Показать завершённый аукцион' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    });
    expect(screen.getByText(/Аукцион завершился без ставок/)).toBeVisible();
    expect(screen.queryByText('Ставка принята')).not.toBeInTheDocument();
  });
});
