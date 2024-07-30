export async function print(f) {
  try {
    window.electronAPI.print(f);
  } catch (error) {
    console.error(error);
  }
}
export async function printHTML(f) {
  try {
    window.electronAPI.printHTML(f);
  } catch (error) {
    console.error(error);
  }
}
export async function printPdf(f) {
  try {
    window.electronAPI.printPdf(f);
  } catch (error) {
    console.error(error);
  }
}
export async function printWord(f) {
  try {
    window.electronAPI.printWord(f);
  } catch (error) {
    console.error(error);
  }
}
export async function printExcel(f) {
  try {
    window.electronAPI.printExcel(f);
  } catch (error) {
    console.error(error);
  }
}
export async function printPPT(f) {
  try {
    window.electronAPI.printPPT(f);
  } catch (error) {
    console.error(error);
  }
}
export async function printJsx(jsx, data) {
  try {
    window.electronAPI.printJsx(jsx, data);
  } catch (error) {
    console.error(error);
  }
}
