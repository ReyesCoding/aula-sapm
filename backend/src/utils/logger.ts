export const logger = {
  info: (...args: any[]) => {
    // eslint-disable-next-line no-console
    console.log(new Date().toISOString(), '[INFO]', ...args);
  },
  error: (...args: any[]) => {
    // eslint-disable-next-line no-console
    console.error(new Date().toISOString(), '[ERROR]', ...args);
  },
};
