import React, { Component, Fragment } from "react";
import dayjs from "dayjs";
import sanitizeHtml from "sanitize-html";
import { withFirebase } from "../Firebase";
import FeedSettings from "./FeedSettings";
import {
  FeedBox,
  FeedHeader,
  FeedImage,
  FeedTitle,
  FeedWrapper,
  FeedList,
  FeedItem,
  ExternalLink,
  ItemTitle,
  Snippet,
  Error,
  SettingsButton,
  SettingsIcon
} from "./styles";

class Feed extends Component {
  constructor(props) {
    super(props);

    this.state = {
      caching: false,
      isSettingsActive: false
    };
  }

  componentDidMount() {
    this.checkCache();
    window.addEventListener("focus", this.onFocus);
  }

  componentWillUnmount() {
    window.removeEventListener("focus", this.onFocus);
  }

  onFocus = () => {
    this.checkCache();
  };

  checkCache() {
    const { feed, firebase } = this.props;
    const { caching } = this.state;

    if (!feed || caching) return;
    const maxCacheMinutes = 15;
    const date1 = dayjs(feed.cachedAt ? feed.cachedAt.toDate() : "");
    const date2 = dayjs(firebase.getTimestamp().toDate());

    if (
      !feed.cache ||
      feed.cache.error ||
      date2.diff(date1, "minute") > maxCacheMinutes
    ) {
      this.reloadData();
    }
  }

  reloadData() {
    const { feed, parser, firebase } = this.props;
    const CORS_PROXY = "https://cors-anywhere.herokuapp.com/";
    const maxCachedItems = 50;

    if (!feed || !parser) return;

    this.setState({ caching: true }, () => {
      // CORS_PROXY + feed.url, "http://localhost:3000/feed.xml"
      parser.parseURL(CORS_PROXY + feed.url, (err, feedData) => {
        const failedData = {
          title: feed.url,
          error: String(err)
        };

        if (feed.cache && !feed.cache.error) {
          if (
            feed.cache.items.length + feedData.items.length <=
            maxCachedItems
          ) {
            feedData.items.concat(feed.cache.items);
          } else {
            const itemsToSlice = maxCachedItems - feedData.items.length;
            feedData.items.concat(feed.cache.items.slice(0, itemsToSlice + 1));
          }
        }

        firebase
          .feed(feed.uid)
          .update({
            ...feed,
            cache: err ? failedData : feedData,
            cachedAt: firebase.fieldValue.serverTimestamp()
          })
          .then(() => {
            this.setState({
              caching: false
            });
            console.log(`Cached: ${feedData.title}`);
          })
          .catch(error => {
            this.setState({
              caching: false
            });
            console.log(`Error caching ${failedData.title}: ${error}`);
          });
      });
    });
  }

  render() {
    const { feed, tab } = this.props;
    const { isSettingsActive } = this.state;
    const data = feed.cache;

    return (
      <FeedBox>
        <FeedHeader>
          <FeedTitle>
            {data && data.image && (
              <FeedImage
                src={data.image.url}
                title={data.image.title}
              ></FeedImage>
            )}
            {data && data.title}
          </FeedTitle>
          <SettingsButton
            onClick={() =>
              this.setState({ isSettingsActive: !isSettingsActive })
            }
          >
            <SettingsIcon />
          </SettingsButton>
        </FeedHeader>
        <FeedWrapper>
          {isSettingsActive && (
            <FeedSettings feed={feed} tab={tab} isActive={isSettingsActive} />
          )}
          {!isSettingsActive && (
            <Fragment>
              {data && !data.error ? (
                <FeedList>
                  {data.items.map(item => {
                    const snippet = sanitizeHtml(
                      item.contentSnippet || item["content:encoded"],
                      { allowedTags: [], allowedAttributes: {} }
                    ).substring(0, 100);
                    return (
                      <FeedItem key={item.guid || item.id}>
                        <ExternalLink
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${dayjs(item.pubDate).format(
                            "DD MMM YYYY"
                          )}: ${item.title} - ${snippet}`}
                        >
                          <ItemTitle>{item.title}</ItemTitle> -{" "}
                          <Snippet
                            dangerouslySetInnerHTML={{
                              __html: snippet
                            }}
                          />
                        </ExternalLink>
                      </FeedItem>
                    );
                  })}
                </FeedList>
              ) : (
                <Error>{data && data.error}</Error>
              )}
            </Fragment>
          )}
        </FeedWrapper>
      </FeedBox>
    );
  }
}

export default withFirebase(Feed);
