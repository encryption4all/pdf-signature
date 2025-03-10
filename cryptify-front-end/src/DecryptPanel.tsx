import "./DecryptPanel.css";
import React from "react";
import createProgressReporter from "./ProgressReporter";
import streamSaver from "streamsaver";
import Lang from "./Lang";
import getTranslation from "./Translations";
import yiviLogo from "./resources/yivi-logo.svg";
import appleAppStoreEN from "./resources/apple-appstore-en.svg";
import googlePlayStoreEN from "./resources/google-playstore-en.svg";
import appleAppStoreNL from "./resources/apple-appstore-nl.svg";
import googlePlayStoreNL from "./resources/google-playstore-nl.svg";
import checkmark from "./resources/checkmark.svg";

import { SMOOTH_TIME, PKG_URL, METRICS_HEADER } from "./Constants";
import { withTransform } from "./utils";

//import "@privacybydesign/yivi-css";
import { IPolicy } from "@e4a/pg-wasm";
import CryptFileInput from "./CryptFileInput";
import {getFileLoadStream} from "./FileProvider";
import CryptFileList from "./CryptFileList";

streamSaver.mitm = `${process.env.PUBLIC_URL}/mitm.html?version=2.0.0`;

enum DecryptionState {
  IrmaSession = 1,
  AskDownload,
  Decrypting,
  Done,
  Error,
}

type StreamDecryptInfo = {
  unsealer: any;
  usk: string;
  id: string;
};

type DecryptState = {
  decryptionState: DecryptionState;
  fakeFile: File | null;
  files: File[];
  decryptInfo: StreamDecryptInfo | null;
  percentage: number;
  done: boolean;
  abort: AbortController;
  selfAborted: boolean;
  decryptStartTime: number;
  modPromise: Promise<any>;
  vkPromise: Promise<string>;
  senderPublic: string;
  senderPrivate?: IPolicy;
};

type DecryptProps = {
  lang: Lang;
  downloadUuid: string;
  recipient: string;
};

async function getVerificationKey(): Promise<string> {
  let resp = await fetch(`${PKG_URL}/v2/sign/parameters`, {
    headers: METRICS_HEADER,
  });
  let params = await resp.json();
  return params.publicKey;
}

const defaultDecryptState: DecryptState = {
  decryptionState: DecryptionState.IrmaSession,
  files: [],
  fakeFile: null,
  decryptInfo: null,
  percentage: 0,
  done: false,
  abort: new AbortController(),
  selfAborted: false,
  decryptStartTime: 0,
  modPromise: import("@e4a/pg-wasm"),
  vkPromise: getVerificationKey(),
  senderPublic: "",
};

export default class DecryptPanel extends React.Component<
  DecryptProps,
  DecryptState
> {
  constructor(props: DecryptProps) {
    super(props);
    this.state = defaultDecryptState;
  }

  // Based on:https://gitlab.science.ru.nl/irma/github-mirrors/irma-frontend-packages/-/blob/master/irma-core/user-agent.js
  isMobile(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    // IE11 doesn't have window.navigator, test differently
    // https://stackoverflow.com/questions/21825157/internet-explorer-11-detection
    // @ts-ignore
    if (!!window.MSInputMethodContext && !!document.documentMode) {
      return false;
    }

    if (/Android/i.test(window.navigator.userAgent)) {
      return true;
    }

    // https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
      return true;
    }

    // https://stackoverflow.com/questions/57776001/how-to-detect-ipad-pro-as-ipad-using-javascript
    if (
      /Macintosh/.test(navigator.userAgent) &&
      navigator.maxTouchPoints &&
      navigator.maxTouchPoints > 2
    ) {
      return true;
    }

    // Neither Android nor iOS, assuming desktop
    return false;
  }

  onFile(files: FileList) {
    const fileArr = Array.from(files);
    this.setState((state) => ({
      files: state.files.concat(fileArr),
    }));
  }

  onRemoveFile(index: number) {
    this.setState((state) => ({
      files: state.files.filter((_, i) => i !== index),
    }));
  }

  async componentDidMount() {
    await this.onDecrypt();
  }

  async onDecrypt() {
    this.setState({
      decryptionState: DecryptionState.IrmaSession,
      selfAborted: false,
      decryptStartTime: Date.now(),
    });

    try {
      await this.applyDecryption();
    } catch (e) {
      console.error("Error occured during decryption");
      console.error(e);
      this.setState({
        decryptionState: DecryptionState.Error,
      });
    }
  }

  async applyDecryption() {

    // Here the uploaded file needs to come
    const [streamSize, encrypted] = await getFileLoadStream(
      this.state.abort.signal,
      this.props.downloadUuid
    );

    const name = `cryptify-${this.props.downloadUuid.split("-")[0]}.zip`;
    const fakeFile: File = {
      name: name,
      size: streamSize,
    } as File;

    this.setState({
      decryptionState: DecryptionState.IrmaSession,
      fakeFile: fakeFile,
    });

    const vk = await this.state.vkPromise;
    const mod = await this.state.modPromise;
    const unsealer = await mod.StreamUnsealer.new(encrypted, vk);

    const sender = unsealer.public_identity();

    // there is always only one sender
    this.setState({ senderPublic: sender.con[0].v });

    const usk = await fetch(`${PKG_URL}/v2/request/key/0`, {
                headers: {
                  ...METRICS_HEADER,
                },
              })
            .then((r) => r.json())
            .then((json) => {
              if (json.status !== "DONE" || json.proofStatus !== "VALID")
                throw new Error("not done and valid");
              return json.key;
            })
            .catch((e) => console.log("error: ", e));

    this.setState({
      decryptionState: DecryptionState.AskDownload,
      decryptInfo: {
        unsealer,
        usk,
        id: this.props.recipient,
      },
    });
  }

  async onCancelDecrypt(ev: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    this.state.abort.abort();
    // Wait until abort occured...
    window.setTimeout(() => {
      this.setState({
        decryptionState: DecryptionState.IrmaSession,
        decryptInfo: null,
        fakeFile: null,
        percentage: 0,
        done: false,
        abort: new AbortController(),
        selfAborted: true,
      });
      this.onDecrypt();
    }, 1000);
  }

  async onDownload() {
    if (this.state.decryptInfo === null || this.state.fakeFile === null) {
      this.setState({
        decryptionState: DecryptionState.Error,
        decryptInfo: null,
        percentage: 0,
      });
      return;
    }

    const rawFileStream = streamSaver.createWriteStream(
      this.state.fakeFile.name,
      { size: this.state.fakeFile.size }
    );
    const fileStream = rawFileStream as WritableStream<Uint8Array>;

    const { unsealer, usk, id }: { unsealer: any; usk: string; id: string } =
      this.state.decryptInfo;

    const finished = new Promise<void>(async (resolve, _) => {
      const progress = createProgressReporter((processed, done) => {
        const fakeFile = this.state.fakeFile as File;
        this.setState({
          decryptionState: DecryptionState.Decrypting,
          percentage: (100 * processed) / fakeFile.size,
        });

        if (done) {
          window.setTimeout(() => {
            this.setState({
              decryptionState: DecryptionState.Decrypting,
              percentage: 100,
              done: true,
            });
            resolve();
          }, 1000 * SMOOTH_TIME);
        }
      }) as TransformStream<Uint8Array, Uint8Array>;

      const verified = await unsealer.unseal(
        id,
        usk,
        withTransform(fileStream, progress, this.state.abort.signal)
      );
      this.setState({ senderPrivate: verified.private });
    });

    await finished;

    this.setState({
      decryptionState: DecryptionState.Done,
      percentage: 100,
      done: true,
    });
  }

  renderSenderIdentity() {
    return (
      <div className="crypt-panel-header">
        <h3>
          <img
            className="checkmark-icon"
            src={checkmark}
            alt="checkmark-icon"
            style={{ height: "0.85em" }}
          />
          {getTranslation(this.props.lang).decryptPanel_verifiedEmail}:{" "}
          {this.state.senderPublic}
        </h3>
      </div>
    );
  }

  renderFilesField() {
    if (this.state.files.length === 0) {
      return (
          <div className="crypt-file-upload-box">
            <CryptFileInput
                lang={this.props.lang}
                onFile={(f) => this.onFile(f)}
                multiple={true}
                required={true}
            />
          </div>
      );
    } else {
      return (
          <div className="crypt-file-upload-box">
            <CryptFileList
                lang={this.props.lang}
                onAddFiles={
                       (f: FileList) => this.onFile(f)
                }
                onRemoveFile={
                       (i) => this.onRemoveFile(i)
                }
                files={this.state.files}
                forUpload={true}
                percentages={[0]}
                done={[true]}
            ></CryptFileList>
          </div>
      );
    }
  }


  renderAskDownload() {
    return (
      <div className="crypt-progress-container">
        <h3>{getTranslation(this.props.lang).decryptPanel_askDownload}</h3>
        <p>{getTranslation(this.props.lang).decryptPanel_askDownloadText}</p>
        <button
          className={"crypt-btn-main crypt-btn"}
          onClick={(e) => this.onDownload()}
          type="button"
        >
          {"Download"}
        </button>
      </div>
    );
  }

  renderProgress() {
    const deltaT = Date.now() - this.state.decryptStartTime;

    const totalProgress = this.state.percentage;

    let timeEstimateRepr = getTranslation(this.props.lang).estimate;
    if (deltaT > 1000 && totalProgress > 1) {
      const remainingProgress = 100 - totalProgress;
      const estimatedT = remainingProgress * (deltaT / totalProgress);
      timeEstimateRepr = getTranslation(this.props.lang).timeremaining(
        estimatedT
      );
    }

    return (
      <div className="crypt-progress-container">
        <h3>{getTranslation(this.props.lang).decryptPanel_downloadDecrypt}</h3>
        <p>{getTranslation(this.props.lang).decryptPanel_decrypting}</p>
        <p>{timeEstimateRepr}</p>

        <button
          className={"crypt-btn crypt-btn-secondary crypt-btn-cancel"}
          onClick={(e) => this.onCancelDecrypt(e)}
          type="button"
        >
          {getTranslation(this.props.lang).cancel}
        </button>
      </div>
    );
  }

  renderDone() {
    return (
      <div className="crypt-progress-container">
        <h3>{getTranslation(this.props.lang).decryptPanel_succes}</h3>
        <h3>
          <img
            className="checkmark-icon"
            src={checkmark}
            alt="checkmark-icon"
            style={{ height: "0.85em" }}
          />
          {getTranslation(this.props.lang).decryptPanel_verifiedEmail}:{" "}
          {this.state.senderPublic}
        </h3>
        {this.state.senderPrivate?.con ? (
          <h3>
            {getTranslation(this.props.lang).decryptPanel_verifiedExtra}:
            <ul>
              {this.state.senderPrivate?.con.map(({ t, v }) => (
                <li key={t}>
                  <img
                    className="checkmark-icon"
                    src={checkmark}
                    alt="checkmark-icon"
                    style={{ height: "0.85em" }}
                  />
                  {getTranslation(this.props.lang)[t]}: {v}
                </li>
              ))}
            </ul>
          </h3>
        ) : null}
      </div>
    );
  }

  renderError() {
    return (
      <div className="crypt-progress-container">
        <h3 className="crypt-progress-error">{"Error occured"}</h3>
        <div
          dangerouslySetInnerHTML={{
            __html: getTranslation(this.props.lang).error,
          }}
        />
        <button
          className={"crypt-btn-main crypt-btn"}
          onClick={(e) => this.onDecrypt()}
          type="button"
        >
          {getTranslation(this.props.lang).tryAgain}
        </button>
      </div>
    );
  }

  render() {
    if (this.state.decryptionState === DecryptionState.IrmaSession) {
      return (
        <div>
          {this.renderSenderIdentity()}
          {this.renderFilesField()}
        </div>
      );
    }
    if (this.state.decryptionState === DecryptionState.AskDownload) {
      return (
        <div>
          {this.renderFilesField()}
          {this.renderAskDownload()}
        </div>
      );
    } else if (this.state.decryptionState === DecryptionState.Decrypting) {
      return (
        <div>
          {this.renderFilesField()}
          {this.renderProgress()}
        </div>
      );
    } else if (this.state.decryptionState === DecryptionState.Done) {
      return (
        <div>
          {this.renderFilesField()}
          {this.renderDone()}
        </div>
      );
    } else if (this.state.decryptionState === DecryptionState.Error) {
      return (
        <div>
          {this.renderFilesField()}
          {this.renderError()}
        </div>
      );
    }
  }
}
