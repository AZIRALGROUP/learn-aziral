import { render,screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach,afterEach,expect,it,vi } from 'vitest';
import TelegramApp from '../telegram/TelegramApp';
import { telegramApi,openAccountLink } from '../telegram/api';
vi.mock('../telegram/api',async original=>({...await original<typeof import('../telegram/api')>(),loadTelegram:vi.fn().mockResolvedValue(undefined),telegramApi:vi.fn(),openAccountLink:vi.fn()}));
const api=vi.mocked(telegramApi);
const rows=[{id:'site-1',title:'Математика сайта',subject:'Математика',count:10,mine:true,published:false,source:'website'},{id:'g1',title:'Minecraft викторина',category:'games',count:10,mine:false,published:true}];
beforeEach(()=>{
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});api.mockReset();
  api.mockImplementation(async path=>{
    if(path==='/me')return {user:{id:'1',name:'Тест'},dev:false,botUsername:'Test',aiAvailable:true,siteConnected:true,siteAccount:{linked:false,user:null}};
    if(path==='/learning')return {stats:{completed:0,total:0,correct:0,lessons:0,duels:0},active:[],recent:[]};
    if(path.startsWith('/tests?'))return path.includes('mine=true')?rows.filter(r=>r.mine):rows;
    if(path==='/ai/generate')return {questions:Array.from({length:10},(_,i)=>({question:'Вопрос '+(i+1),options:['А','Б','В','Г'],correct:i%4,explanation:'Объяснение'}))};
    if(path==='/tests')return {id:'new'};
    if(path==='/account/link')return {url:'https://example.com/connect-account?code=private'};
    throw new Error('Unexpected request '+path);
  });
});
afterEach(()=>vi.restoreAllMocks());
it('browses categories before subjects and keeps owned website drafts in My tests',async()=>{
  const user=userEvent.setup();render(<TelegramApp/>);
  await user.click(await screen.findByRole('button',{name:/^Учёба/}));
  expect(await screen.findByText('Математика сайта')).toBeVisible();
  expect(screen.queryByText('Minecraft викторина')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Все категории'}));
  await user.click(screen.getByRole('button',{name:/^Игры/}));
  expect(screen.getByText('Minecraft викторина')).toBeVisible();
  expect(screen.queryByText('Математика сайта')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Мои',exact:true}));
  expect(await screen.findByText('Математика сайта')).toBeVisible();
  expect(screen.getByText('Черновик')).toBeVisible();
});
it('generates a complete categorized AI test and saves all reviewed questions',async()=>{
  const user=userEvent.setup();render(<TelegramApp/>);
  await user.click(await screen.findByRole('button',{name:'Создать тест',exact:true}));
  await user.type(screen.getByLabelText('Название',{exact:true}),'Мир Minecraft');
  await user.selectOptions(screen.getByLabelText('Категория'),'games');
  expect(screen.queryByLabelText('Вопрос',{exact:true})).not.toBeInTheDocument();
  await user.click(screen.getByRole('checkbox',{name:'Разрешаю отправить материал в Gemini'}));
  await user.click(screen.getByRole('button',{name:'Создать тест',exact:true}));
  await screen.findByDisplayValue('Вопрос 1');
  await user.click(screen.getByRole('button',{name:'Сохранить',exact:true}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/tests','POST',expect.objectContaining({category:'games',title:'Мир Minecraft',questions:expect.arrayContaining([expect.objectContaining({question:'Вопрос 10'})])})));
});
it('opens the browser connection from Profile without asking for a website password inside Telegram',async()=>{
  const user=userEvent.setup();render(<TelegramApp/>);
  await user.click(await screen.findByRole('button',{name:'Профиль',exact:true}));
  await user.click(screen.getByRole('button',{name:'Подключить через браузер'}));
  await waitFor(()=>expect(openAccountLink).toHaveBeenCalledWith('https://example.com/connect-account?code=private'));
  expect(screen.queryByLabelText(/пароль/i)).not.toBeInTheDocument();
});
