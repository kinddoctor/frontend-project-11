import * as yup from 'yup';
import axios from 'axios';

const getUniqueId = () => Math.random().toString(36).substring(2, 6);

const comparePosts = (fresh, old) => fresh.title === old.title;

const hasRSS = (xml) => xml.children[0].localName === 'rss';

const validate = (url, addedUrls) => {
  yup.setLocale({
    mixed: { notOneOf: 'already exists' },
    string: { url: 'invalid url' },
  });
  const schema = yup.string().url().notOneOf(addedUrls);
  return schema.validate(url);
};

const makeUrlProxied = (url) => {
  const proxy = new URL('https://allorigins.hexlet.app/get?disableCache=true');
  proxy.searchParams.append('url', url);
  return proxy.href;
};

const loadData = (url) => {
  const proxiedUrl = makeUrlProxied(url);
  return axios.get(proxiedUrl);
};

const getValueOfField = (array, fieldName) => {
  const field = array.find((el) => el.nodeName === fieldName);
  return field.textContent;
};

const getNormalizedData = (xmlDoc) => {
  const rss = xmlDoc.children[0];
  const channel = rss.children[0];

  const feedData = Array.from(channel.children);
  const feedUrl = getValueOfField(feedData, 'link');
  const feedTitle = getValueOfField(feedData, 'title');
  const feedDescription = getValueOfField(feedData, 'description');
  const feed = {
    url: feedUrl,
    title: feedTitle,
    description: feedDescription,
  };

  const postsData = feedData.filter((el) => el.nodeName === 'item');
  const posts = postsData.reduce((acc, item) => {
    const postData = Array.from(item.children);
    const postUrl = getValueOfField(postData, 'link');
    const postTitle = getValueOfField(postData, 'title');
    const postDescription = getValueOfField(postData, 'description');
    const post = {
      url: postUrl,
      title: postTitle,
      description: postDescription,
    };
    return [...acc, post];
  }, []);

  return { feed, posts };
};

const parseData = (data) => {
  const parser = new DOMParser();
  let parsedData;
  try {
    parsedData = parser.parseFromString(data, 'text/xml');
  } catch (e) {
    throw new Error('Parsing Error');
  }
  if (!hasRSS(parsedData)) {
    throw new Error('doesn`t has rss');
  }
  const normalizedData = getNormalizedData(parsedData);
  return normalizedData;
};

export {
  validate,
  getUniqueId,
  comparePosts,
  loadData,
  parseData,
};
