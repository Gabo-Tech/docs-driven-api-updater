import chalk from "chalk";

/**
 * Colored logger wrapper for consistent CLI output.
 */
export const logger = {
  info(message: string): void {
    console.log(chalk.cyan(message));
  },
  success(message: string): void {
    console.log(chalk.green(message));
  },
  warn(message: string): void {
    console.warn(chalk.yellow(message));
  },
  error(message: string): void {
    console.error(chalk.red(message));
  },
  dim(message: string): void {
    console.log(chalk.gray(message));
  }
};
