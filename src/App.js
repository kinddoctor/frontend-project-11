import i18next from 'i18next';
import { differenceWith } from 'lodash';
import makeStateWatched from './View.js';
import {
  validate, loadData, parseData,
  getUniqueId, comparePosts,
} from './Utils.js';

const app = (initialState, i18nextInst) => {
  const UIelements = {
    body: document.querySelector('body'),
    postsAndFeedsArea: document.querySelector('.container-xxl'),
    form: document.querySelector('form'),
    input: document.querySelector('#url-input'),
    submitButton: document.querySelector('button[type="submit"]'),
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

  const handleSubmit = (event) => {
    event.preventDefault();
    watchedState.state = 'validating';
    const urlString = watchedState.inputValue;
    validate(urlString, watchedState.addedRSSLinks)
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
        newFeed.id = feedId;
        const { feeds, posts } = watchedState.addedRSSData;
        const newPostsFulfilled = newPosts.map((post) => ({ ...post, feedId, id: getUniqueId() }));
        watchedState.addedRSSData.posts = [...posts, ...newPostsFulfilled];
        watchedState.addedRSSData.feeds = [...feeds, newFeed];
      })
      .catch((err) => {
        handleError(err);
      });
  };

  const handleInputChange = ({ target }) => {
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

  const handlePostsAuxclick = (e) => {
    const linkElement = e.target.localName === 'a' && e.target.hasAttribute('data-id');
    if (linkElement) {
      const id = e.target.getAttribute('data-id');
      watchedState.UIstate.watchedPostsIds.push(id);
    }
  };

  const handleModal = (event) => {
    const button = event.relatedTarget;
    const clickedPostId = button.getAttribute('data-id');
    const clickedPost = watchedState.addedRSSData.posts.filter(({ id }) => id === clickedPostId)[0];
    const { title, description, url } = clickedPost;
    watchedState.UIstate.modalData = {};
    watchedState.UIstate.modalData = { title, description, url };
  };

  const updatePostsList = (links) => {
    if (links.length === 0) {
      return setTimeout(() => updatePostsList(watchedState.addedRSSLinks), '5000');
    }
    let allNewPosts = [];
    const promises = links.map((link) => Promise.resolve(loadData(link)));
    return Promise.all(promises)
      .then((values) => {
        values.forEach(({ data }) => {
          const freshData = parseData(data.contents);
          const { feed: freshFeed, posts: freshPosts } = freshData;
          const { feeds, posts } = watchedState.addedRSSData;
          const feedId = feeds.find((feed) => feed.title === freshFeed.title).id;
          const postsToAdd = differenceWith(freshPosts, posts, comparePosts);
          const postsToAddFulfilled = postsToAdd.map((post) => (
            { ...post, feedId, id: getUniqueId() }
          ));
          allNewPosts = [...allNewPosts, ...postsToAddFulfilled];
        });
        watchedState.addedRSSData.posts = [...watchedState.addedRSSData.posts, ...allNewPosts];
        watchedState.updateStatus = 'success';
      })
      .catch((err) => {
        watchedState.updateStatus = '';
        watchedState.updateStatus = 'failed';
        console.log(`${err.message}`);
      })
      .finally(() => setTimeout(() => updatePostsList(watchedState.addedRSSLinks), '5000'));
  };

  UIelements.input.addEventListener('input', handleInputChange);
  UIelements.form.addEventListener('submit', handleSubmit);
  UIelements.modal.addEventListener('show.bs.modal', handleModal);
  UIelements.postsAndFeedsArea.addEventListener('click', handlePostsClick);
  UIelements.postsAndFeedsArea.addEventListener('auxclick', handlePostsAuxclick);
  updatePostsList(watchedState.addedRSSLinks);
};

const runApp = () => {
  const initialState = {
    state: 'initialState',
    errorMessage: '',
    inputValue: '',
    updateStatus: 'hasn`t been updated yet',
    addedRSSLinks: [],
    addedRSSData: { feeds: [], posts: [] },
    UIstate: {
      watchedPostsIds: [],
      modalData: {}, // title, description, url
    },
  };
  const i18nextInstance = i18next.createInstance();
  i18nextInstance.init({
    lng: 'ru',
    debug: true,
    resources: {
      ru: {
        translation: {
          postsTitle: 'Посты',
          feedsTitle: 'Фиды',
          quickViewBtn: 'Просмотр',
          loadingProcess: 'Идет загрузка',
          success: 'RSS успешно загружен',
          error: {
            'invalid url': 'Ссылка должна быть валидным URL',
            'already exists': 'RSS уже существует',
            'network error': 'Ошибка сети',
            'doesn`t has rss': 'Ресурс не содержит валидный RSS',
            'parsing error': 'Ошибка обработки данных',
            'update error': 'Ошибка обновления постов',
          },
          unexpectedError: '{{error}}',
        },
      },
    },
  }).then(() => app(initialState, i18nextInstance));
};

export default runApp;
