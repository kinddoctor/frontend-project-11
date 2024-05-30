import * as yup from 'yup';
import i18next from 'i18next';
import makeStateWatched from './View.js';
import {
  getUniqueId, loadData, parseData,
  getNormalizedData, getRenewedData,
} from './Utils.js';

const app = (initialState, i18nextInst) => {
  const UIelements = {
    body: document.querySelector('body'),
    postsAndFeedsArea: document.querySelector('.container-xxl'),
    form: document.querySelector('form'),
    input: document.querySelector('#url-input'),
    button: document.querySelector('button[type="submit"]'),
    feedback: document.querySelector('.feedback'),
    posts: {
      title: document.querySelector('div.posts h2'),
      list: document.querySelector('div.posts ul'),
    },
    feeds: {
      title: document.querySelector('div.feeds h2'),
      list: document.querySelector('div.feeds ul'),
    },
    modal: document.querySelector('#modal'),
    modalTitle: document.querySelector('.modal-title'),
    modalTextArea: document.querySelector('.modal-body'),
    modalFullArticleButton: document.querySelector('.full-article'),
  };
  const watchedState = makeStateWatched(initialState, UIelements, i18nextInst);

  const handleError = ({ message }) => {
    watchedState.state = 'error';
    const expectedErrorMessages = [
      'Network Error', 'Parsing Error', 'doesn`t has rss', 'invalid url', 'already exists',
    ];
    if (expectedErrorMessages.includes(message)) {
      watchedState.errorMessage = '';
      watchedState.errorMessage = message.toLowerCase();
    } else {
      watchedState.errorMessage = `Unexpected error - ${message}`;
    }
  };

  const validate = (url) => {
    yup.setLocale({
      mixed: { notOneOf: 'already exists' },
      string: { url: 'invalid url' },
    });
    const schema = yup.string().url().notOneOf(watchedState.addedRSSLinks);
    return schema.validate(url);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    watchedState.state = 'validating';
    const urlString = watchedState.inputValue;
    validate(urlString)
      .then((url) => {
        watchedState.state = 'loading';
        return loadData(url);
      })
      .then(({ data }) => {
        const url = watchedState.inputValue;
        watchedState.state = 'parsing';
        const { feed: newFeed, posts: newPosts } = parseData(data.contents);
        watchedState.addedRSSLinks.push(url);
        watchedState.state = 'success';
        const feedId = getUniqueId();
        newFeed.feedId = feedId;
        newPosts.forEach((post) => {
          const postWithFeedId = { ...post, feedId };
          return postWithFeedId;
        });
        const { feeds, posts } = watchedState.addedRSSData;
        watchedState.addedRSSData.posts = [...posts, ...newPosts];
        watchedState.addedRSSData.feeds = [...feeds, ...newFeed];
      })
      .catch((err) => {
        handleError(err);
      });
  };

  const handleInputChange = ({ target }) => {
    console.log(`${JSON.stringify(watchedState)}`);
    const url = target.value;
    watchedState.inputValue = url;
    watchedState.state = 'filling';
  };

  const handlePostsClick = (e) => {
    const linkOrBtnElement = e.target.hasAttribute('data-id');
    if (linkOrBtnElement) {
      const id = e.target.getAttribute('data-id');
      watchedState.UIstate.watchedPostsIds.push(id);
    }
  };

  const handleModal = (event) => {
    const button = event.relatedTarget;
    const postId = button.getAttribute('data-id');
    const { title, description, url } = watchedState.addedRSSData.posts[postId];
    watchedState.UIstate.modalData = [];
    watchedState.UIstate.modalData.push(title, description, url);
  };

  const updatePostsList = (links) => {
    if (links.length === 0) {
      return setTimeout(() => updatePostsList(watchedState.addedRSSLinks), '5000');
    }
    const newData = { feeds: {}, posts: {} };
    const oldData = watchedState.addedRSSData;
    const promises = links.map((link) => Promise.resolve(loadData(link)));
    return Promise.all(promises)
      .then((values) => {
        values.forEach(({ data }) => {
          const xml = parseData(data.contents);
          const { feed: newFeed, posts: newPosts } = getNormalizedData(xml);
          newData.feeds = { ...newData.feeds, ...newFeed };
          newData.posts = { ...newData.posts, ...newPosts };
        });
        const { renewedFeeds, renewedPosts } = getRenewedData(oldData, newData);
        watchedState.addedRSSData.posts = { ...renewedPosts };
        watchedState.addedRSSData.feeds = { ...renewedFeeds };
      })
      .catch((err) => {
        handleError(err);
      })
      .finally(() => setTimeout(() => updatePostsList(watchedState.addedRSSLinks), '5000'));
  };

  UIelements.input.addEventListener('input', handleInputChange);
  UIelements.form.addEventListener('submit', handleSubmit);
  UIelements.modal.addEventListener('show.bs.modal', handleModal);
  UIelements.postsAndFeedsArea.addEventListener('click', handlePostsClick);
  updatePostsList(watchedState.addedRSSLinks);
};

const runApp = () => {
  const initialState = {
    state: 'initialState',
    errorMessage: '',
    inputValue: '',
    addedRSSLinks: [],
    addedRSSData: { feeds: [], posts: [] },
    UIstate: {
      watchedPostsIds: [],
      modalData: [], // title, description, postUrl
    },
  };
  const i18nextInstance = i18next.createInstance();
  i18nextInstance.init({
    lng: 'ru',
    debug: true,
    resources: {
      ru: {
        translation: {
          error: {
            'invalid url': 'Ссылка должна быть валидным URL',
            'already exists': 'RSS уже существует',
            'network error': 'Ошибка сети',
            'doesn`t has rss': 'Ресурс не содержит валидный RSS',
            'parsing error': 'Ошибка обработки данных',
          },
          unexpectedError: '{{error}}',
          loadingProcess: 'Идет загрузка',
          success: 'RSS успешно загружен',
          postsTitle: 'Посты',
          feedsTitle: 'Фиды',
        },
      },
    },
  }).then(() => app(initialState, i18nextInstance));
};

export default runApp;
