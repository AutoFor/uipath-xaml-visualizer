var XamlViewer;
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/parser/xaml-parser.ts"
/*!***********************************!*\
  !*** ./src/parser/xaml-parser.ts ***!
  \***********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   XamlParser: () => (/* binding */ XamlParser)
/* harmony export */ });
/**
 * UiPath XAML パーサー
 * XAMLファイルをパースして構造化データに変換
 */
/**
 * XAMLパーサークラス
 */
class XamlParser {
    constructor() {
        this.activityIdCounter = 0; // アクティビティID生成用カウンター
    }
    /**
     * XAMLテキストをパースして構造化データに変換
     */
    parse(xamlText) {
        // XMLをパース
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xamlText, 'text/xml');
        // パースエラーチェック
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            throw new Error('XAML解析エラー: ' + parseError.textContent);
        }
        // ルート要素を取得
        const root = xmlDoc.documentElement;
        // 変数と引数を抽出
        const variables = this.extractVariables(root);
        const argumentsData = this.extractArguments(root);
        // ルートアクティビティをパース
        const rootActivity = this.parseActivity(root);
        return {
            rootActivity,
            variables,
            arguments: argumentsData
        };
    }
    /**
     * アクティビティ要素をパース
     */
    parseActivity(element) {
        const id = `activity-${this.activityIdCounter++}`;
        const type = element.localName; // 要素名（Sequence, Assign等）
        const displayName = element.getAttribute('DisplayName') || type;
        const namespace = element.prefix || undefined;
        // プロパティを抽出
        const properties = this.extractProperties(element);
        // InformativeScreenshot属性を取得
        const informativeScreenshot = element.getAttribute('InformativeScreenshot') || undefined;
        // アノテーションを取得
        const annotations = this.extractAnnotations(element);
        // 子アクティビティをパース
        const children = this.parseChildren(element);
        return {
            id,
            type,
            displayName,
            namespace,
            properties,
            children,
            annotations,
            informativeScreenshot
        };
    }
    /**
     * プロパティを抽出
     */
    extractProperties(element) {
        const properties = {};
        // 属性からプロパティを取得
        Array.from(element.attributes).forEach(attr => {
            if (attr.name !== 'DisplayName' && attr.name !== 'InformativeScreenshot') {
                properties[attr.name] = attr.value;
            }
        });
        // 子要素からプロパティを取得（Assign.To, Assign.Value等）
        Array.from(element.children).forEach(child => {
            const childName = child.localName;
            // プロパティ要素（タイプ名.プロパティ名形式）
            if (childName.includes('.')) {
                const [, propName] = childName.split('.');
                properties[propName] = this.extractPropertyValue(child);
            }
        });
        return properties;
    }
    /**
     * プロパティ値を抽出
     */
    extractPropertyValue(element) {
        // テキストコンテンツがあればそれを返す
        if (element.textContent?.trim()) {
            return element.textContent.trim();
        }
        // 子要素があれば構造化して返す
        const children = Array.from(element.children);
        if (children.length === 1) {
            const child = children[0];
            // OutArgument, InArgument等の場合は中身を返す
            if (child.localName.includes('Argument')) {
                return child.textContent?.trim() || '';
            }
            // Selector等の複雑な構造の場合
            return this.elementToObject(child);
        }
        return null;
    }
    /**
     * 要素をオブジェクトに変換
     */
    elementToObject(element) {
        const obj = {
            type: element.localName
        };
        // 属性を追加
        Array.from(element.attributes).forEach(attr => {
            obj[attr.name] = attr.value;
        });
        // 子要素を再帰的に処理
        const children = Array.from(element.children);
        if (children.length > 0) {
            obj.children = children.map(child => this.elementToObject(child));
        }
        else if (element.textContent?.trim()) {
            obj.value = element.textContent.trim();
        }
        return obj;
    }
    /**
     * 子アクティビティをパース
     */
    parseChildren(element) {
        const children = [];
        Array.from(element.children).forEach(child => {
            const childName = child.localName;
            // プロパティ要素は除外（例: NApplicationCard.Body）
            if (childName.includes('.')) {
                // ただし、プロパティ要素の中身は再帰的に処理
                const nestedActivities = this.parseChildren(child);
                children.push(...nestedActivities);
                return;
            }
            // メタデータ要素を除外
            if (this.isMetadataElement(child)) {
                return;
            }
            // アクティビティとして解析
            if (this.isActivity(child)) {
                children.push(this.parseActivity(child));
            }
        });
        return children;
    }
    /**
     * メタデータ要素かどうかを判定（アクティビティではない要素）
     */
    isMetadataElement(element) {
        const name = element.localName;
        // メタデータ要素のリスト
        const metadataTypes = [
            'WorkflowViewStateService.ViewState',
            'Dictionary',
            'Boolean',
            'String',
            'Property',
            'Variable',
            'InArgument',
            'OutArgument',
            'InOutArgument',
            'ActivityAction',
            'DelegateInArgument',
            'DelegateOutArgument',
            'TargetApp',
            'TargetAnchorable',
            'Target'
        ];
        // プレフィックスでチェック（sap:, scg:, x: など）
        const prefix = element.prefix;
        if (prefix === 'sap' || prefix === 'sap2010' || prefix === 'scg' || prefix === 'sco' || prefix === 'x') {
            return true;
        }
        return metadataTypes.includes(name);
    }
    /**
     * アクティビティ要素かどうかを判定
     */
    isActivity(element) {
        const name = element.localName;
        // よくあるアクティビティタイプ（基本）
        const activityTypes = [
            'Sequence', 'Flowchart', 'StateMachine', 'Assign', 'If', 'While',
            'ForEach', 'Switch', 'TryCatch', 'Click', 'TypeInto', 'GetText',
            'LogMessage', 'WriteLine', 'InvokeWorkflowFile', 'Delay',
            // UiPath UIAutomation Next アクティビティ
            'NApplicationCard', 'NClick', 'NTypeInto', 'NGetText', 'NHover',
            'NKeyboardShortcut', 'NDoubleClick', 'NRightClick', 'NCheck',
            'NSelect', 'NAttach', 'NWaitElement', 'NFindElement',
            // その他のよくあるUiPathアクティビティ
            'OpenBrowser', 'CloseBrowser', 'NavigateTo', 'AttachBrowser',
            'ReadRange', 'WriteRange', 'AddDataRow', 'BuildDataTable',
            'ForEachRow', 'ExcelApplicationScope', 'UseExcelFile'
        ];
        // リストにあればアクティビティ
        if (activityTypes.includes(name)) {
            return true;
        }
        // メタデータ要素でなければアクティビティとして扱う
        return !this.isMetadataElement(element);
    }
    /**
     * 変数を抽出
     */
    extractVariables(root) {
        const variables = [];
        // <Sequence.Variables> 等を探索
        const variableElements = root.querySelectorAll('[x\\:TypeArguments]');
        variableElements.forEach(elem => {
            const name = elem.getAttribute('Name');
            const type = elem.getAttribute('x:TypeArguments');
            const defaultValue = elem.querySelector('Default')?.textContent?.trim();
            if (name && type) {
                variables.push({
                    name,
                    type,
                    default: defaultValue
                });
            }
        });
        return variables;
    }
    /**
     * 引数を抽出
     */
    extractArguments(root) {
        const argumentsData = [];
        // <x:Property> 要素を探索
        const propertyElements = root.querySelectorAll('x\\:Property');
        propertyElements.forEach(elem => {
            const name = elem.getAttribute('Name');
            const type = elem.getAttribute('Type');
            if (name && type) {
                // Type属性から方向とデータ型を抽出（例: InArgument(x:String)）
                const match = type.match(/(In|Out|InOut)Argument\((.+)\)/);
                if (match) {
                    argumentsData.push({
                        name,
                        type: match[1], // In/Out/InOut
                        dataType: match[2] // データ型
                    });
                }
            }
        });
        return argumentsData;
    }
    /**
     * アノテーションを抽出
     */
    extractAnnotations(element) {
        const annotationElem = element.querySelector('sap\\:WorkflowViewStateService\\.ViewState > scg\\:Dictionary > x\\:String[x\\:Key="Annotation"]');
        return annotationElem?.textContent?.trim();
    }
}


/***/ },

/***/ "./src/renderer/sequence-renderer.ts"
/*!*******************************************!*\
  !*** ./src/renderer/sequence-renderer.ts ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SequenceRenderer: () => (/* binding */ SequenceRenderer)
/* harmony export */ });
/**
 * Sequenceワークフローのレンダラー
 */
class SequenceRenderer {
    /**
     * アクティビティツリーをHTMLとしてレンダリング
     */
    render(parsedData, container) {
        container.innerHTML = ''; // コンテナをクリア
        // ルートアクティビティからレンダリング開始
        const rootElement = this.renderActivity(parsedData.rootActivity);
        container.appendChild(rootElement);
    }
    /**
     * アクティビティをHTMLにレンダリング
     */
    renderActivity(activity) {
        const card = document.createElement('div');
        card.className = 'activity-card';
        card.dataset.id = activity.id; // データ属性にIDを設定
        card.dataset.type = activity.type; // データ属性にタイプを設定
        // アイコンとヘッダー
        const header = document.createElement('div');
        header.className = 'activity-header';
        const icon = this.getActivityIcon(activity.type);
        const title = document.createElement('span');
        title.className = 'activity-title';
        title.textContent = `${icon} ${activity.type}: ${activity.displayName}`;
        header.appendChild(title);
        card.appendChild(header);
        // プロパティ表示
        if (Object.keys(activity.properties).length > 0) {
            const propsDiv = this.renderProperties(activity.properties);
            card.appendChild(propsDiv);
        }
        // InformativeScreenshot表示
        if (activity.informativeScreenshot) {
            const screenshotDiv = this.renderScreenshot(activity.informativeScreenshot);
            card.appendChild(screenshotDiv);
        }
        // 子アクティビティを再帰的にレンダリング
        if (activity.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'activity-children';
            activity.children.forEach(child => {
                const childElement = this.renderActivity(child);
                childrenContainer.appendChild(childElement);
            });
            card.appendChild(childrenContainer);
        }
        // クリックイベント: 詳細パネルを開く
        card.addEventListener('click', (e) => {
            e.stopPropagation(); // イベント伝播を停止
            this.showDetailPanel(activity);
        });
        return card;
    }
    /**
     * プロパティをレンダリング
     */
    renderProperties(properties) {
        const propsDiv = document.createElement('div');
        propsDiv.className = 'activity-properties';
        // 主要なプロパティのみ表示（簡略表示）
        const importantProps = ['To', 'Value', 'Condition', 'Selector', 'Message'];
        Object.entries(properties).forEach(([key, value]) => {
            if (importantProps.includes(key)) {
                const propItem = document.createElement('div');
                propItem.className = 'property-item';
                const propKey = document.createElement('span');
                propKey.className = 'property-key';
                propKey.textContent = `${key}:`;
                const propValue = document.createElement('span');
                propValue.className = 'property-value';
                propValue.textContent = this.formatValue(value);
                propItem.appendChild(propKey);
                propItem.appendChild(propValue);
                propsDiv.appendChild(propItem);
            }
        });
        return propsDiv;
    }
    /**
     * スクリーンショットをレンダリング
     */
    renderScreenshot(filename) {
        const screenshotDiv = document.createElement('div');
        screenshotDiv.className = 'informative-screenshot';
        const label = document.createElement('div');
        label.className = 'screenshot-label';
        label.textContent = '📷 Informative Screenshot:';
        const img = document.createElement('img');
        img.className = 'screenshot-thumbnail';
        img.src = this.resolveScreenshotPath(filename); // スクリーンショットパスを解決
        img.alt = filename;
        img.loading = 'lazy'; // 遅延読み込み
        // 画像読み込みエラー時の処理
        img.onerror = () => {
            screenshotDiv.innerHTML = `
        <div class="screenshot-error">
          ⚠️ 画像が見つかりません<br>
          ${filename}
        </div>
      `;
        };
        // 拡大ボタン
        const expandBtn = document.createElement('button');
        expandBtn.className = 'screenshot-expand-btn';
        expandBtn.textContent = '🔍 拡大';
        expandBtn.onclick = (e) => {
            e.stopPropagation(); // カードのクリックイベントを阻止
            this.showScreenshotModal(filename, img.src);
        };
        screenshotDiv.appendChild(label);
        screenshotDiv.appendChild(img);
        screenshotDiv.appendChild(expandBtn);
        return screenshotDiv;
    }
    /**
     * スクリーンショットのパスを解決
     */
    resolveScreenshotPath(filename) {
        // TODO: Azure DevOps APIを使用して実際のパスを取得
        // 現時点ではプレースホルダーを返す
        return `.screenshots/${filename}`;
    }
    /**
     * スクリーンショット拡大モーダルを表示
     */
    showScreenshotModal(filename, src) {
        // モーダルを作成
        const modal = document.createElement('div');
        modal.className = 'screenshot-modal';
        modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>📷 ${filename}</h3>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <img src="${src}" alt="${filename}" />
        </div>
      </div>
    `;
        document.body.appendChild(modal);
        // 閉じるボタンのイベント
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn?.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        // モーダル背景クリックで閉じる
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
    /**
     * 詳細パネルを表示
     */
    showDetailPanel(activity) {
        const detailPanel = document.getElementById('detail-panel');
        const detailContent = document.getElementById('detail-content');
        if (!detailPanel || !detailContent)
            return;
        // 詳細情報をレンダリング
        detailContent.innerHTML = `
      <div class="detail-section">
        <h4>${this.getActivityIcon(activity.type)} ${activity.type}</h4>
        <p><strong>DisplayName:</strong> ${activity.displayName}</p>
      </div>
      <div class="detail-section">
        <h4>プロパティ</h4>
        ${this.renderAllProperties(activity.properties)}
      </div>
      ${activity.annotations ? `
        <div class="detail-section">
          <h4>📎 Annotations</h4>
          <p>${activity.annotations}</p>
        </div>
      ` : ''}
    `;
        detailPanel.style.display = 'block'; // パネルを表示
    }
    /**
     * すべてのプロパティを詳細表示
     */
    renderAllProperties(properties) {
        return Object.entries(properties)
            .map(([key, value]) => `
        <div class="property-row">
          <span class="prop-key">${key}:</span>
          <span class="prop-value">${this.formatValue(value)}</span>
        </div>
      `)
            .join('');
    }
    /**
     * 値をフォーマット
     */
    formatValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2); // オブジェクトはJSON文字列化
        }
        return String(value);
    }
    /**
     * アクティビティタイプに応じたアイコンを取得
     */
    getActivityIcon(type) {
        const iconMap = {
            // 基本ワークフロー
            'Sequence': '🔄',
            'Flowchart': '📊',
            'StateMachine': '⚙️',
            // 制御フロー
            'Assign': '📝',
            'If': '🔀',
            'While': '🔁',
            'ForEach': '🔁',
            'Switch': '🔀',
            'TryCatch': '⚠️',
            'Delay': '⏱️',
            // 旧UIAutomation
            'Click': '🖱️',
            'TypeInto': '⌨️',
            'GetText': '📄',
            // UIAutomation Next (N系)
            'NApplicationCard': '🖼️', // アプリケーションスコープ
            'NClick': '🖱️', // クリック
            'NTypeInto': '⌨️', // 入力
            'NGetText': '📄', // テキスト取得
            'NHover': '👆', // ホバー
            'NDoubleClick': '🖱️', // ダブルクリック
            'NRightClick': '🖱️', // 右クリック
            'NCheck': '☑️', // チェックボックス
            'NSelect': '📋', // 選択
            'NAttach': '📎', // アタッチ
            'NWaitElement': '⏳', // 要素待機
            'NFindElement': '🔍', // 要素検索
            'NKeyboardShortcut': '⌨️', // ショートカット
            // その他
            'LogMessage': '📋',
            'WriteLine': '📝',
            'InvokeWorkflowFile': '📤',
            'OpenBrowser': '🌐',
            'CloseBrowser': '🌐',
            'NavigateTo': '🌐',
            'AttachBrowser': '🌐',
            // Excel
            'ReadRange': '📊',
            'WriteRange': '📊',
            'ExcelApplicationScope': '📊',
            'UseExcelFile': '📊'
        };
        return iconMap[type] || '📦'; // デフォルトアイコン
    }
}


/***/ },

/***/ "./src/renderer/tree-view-renderer.ts"
/*!********************************************!*\
  !*** ./src/renderer/tree-view-renderer.ts ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TreeViewRenderer: () => (/* binding */ TreeViewRenderer)
/* harmony export */ });
/**
 * ツリービューレンダラー
 */
class TreeViewRenderer {
    /**
     * アクティビティツリーをツリー表示としてレンダリング
     */
    render(parsedData, container) {
        container.innerHTML = ''; // コンテナをクリア
        // ルートアクティビティからツリーを生成
        const tree = this.createTreeNode(parsedData.rootActivity, 0);
        container.appendChild(tree);
    }
    /**
     * ツリーノードを作成
     */
    createTreeNode(activity, depth) {
        const treeItem = document.createElement('div');
        treeItem.className = 'tree-item';
        treeItem.dataset.id = activity.id; // データ属性にIDを設定
        treeItem.style.paddingLeft = `${depth * 20}px`; // インデント
        // 展開/折りたたみボタン
        const hasChildren = activity.children.length > 0;
        const toggleBtn = document.createElement('span');
        toggleBtn.className = 'tree-toggle';
        toggleBtn.textContent = hasChildren ? '▼' : '  '; // 子がある場合は▼
        toggleBtn.style.cursor = hasChildren ? 'pointer' : 'default';
        // ラベル
        const label = document.createElement('span');
        label.className = 'tree-label';
        label.textContent = `${this.getActivityIcon(activity.type)} ${activity.displayName}`;
        // ノードをクリックしたらメインビューでハイライト
        label.addEventListener('click', () => {
            this.highlightActivity(activity.id);
        });
        treeItem.appendChild(toggleBtn);
        treeItem.appendChild(label);
        // 子ノードのコンテナ
        if (hasChildren) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';
            activity.children.forEach(child => {
                const childNode = this.createTreeNode(child, depth + 1);
                childrenContainer.appendChild(childNode);
            });
            treeItem.appendChild(childrenContainer);
            // 展開/折りたたみのイベント
            toggleBtn.addEventListener('click', () => {
                const isExpanded = !childrenContainer.classList.contains('collapsed');
                childrenContainer.classList.toggle('collapsed', isExpanded);
                toggleBtn.textContent = isExpanded ? '▶' : '▼'; // アイコン変更
            });
        }
        return treeItem;
    }
    /**
     * メインビューで該当アクティビティをハイライト
     */
    highlightActivity(activityId) {
        // 既存のハイライトを削除
        document.querySelectorAll('.activity-card.highlighted').forEach(el => {
            el.classList.remove('highlighted');
        });
        // 該当アクティビティにハイライトを追加
        const targetCard = document.querySelector(`.activity-card[data-id="${activityId}"]`);
        if (targetCard) {
            targetCard.classList.add('highlighted');
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); // スクロール
        }
    }
    /**
     * アクティビティタイプに応じたアイコンを取得
     */
    getActivityIcon(type) {
        const iconMap = {
            'Sequence': '🔄',
            'Flowchart': '📊',
            'Assign': '📝',
            'If': '🔀',
            'While': '🔁',
            'ForEach': '🔁',
            'Click': '🖱️',
            'TypeInto': '⌨️',
            'GetText': '📄',
            'LogMessage': '📋',
            'InvokeWorkflowFile': '📤',
            'TryCatch': '⚠️',
            'Delay': '⏱️'
        };
        return iconMap[type] || '📦'; // デフォルトアイコン
    }
}


/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Check if module exists (development only)
/******/ 		if (__webpack_modules__[moduleId] === undefined) {
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!***************************************!*\
  !*** ./src/test-viewer-standalone.ts ***!
  \***************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _parser_xaml_parser__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./parser/xaml-parser */ "./src/parser/xaml-parser.ts");
/* harmony import */ var _renderer_sequence_renderer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./renderer/sequence-renderer */ "./src/renderer/sequence-renderer.ts");
/* harmony import */ var _renderer_tree_view_renderer__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./renderer/tree-view-renderer */ "./src/renderer/tree-view-renderer.ts");
/**
 * ローカルテスト用のスタンドアロンビューア
 * ブラウザのグローバルスコープに公開
 */



// グローバルスコープに公開
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
    XamlParser: _parser_xaml_parser__WEBPACK_IMPORTED_MODULE_0__.XamlParser,
    SequenceRenderer: _renderer_sequence_renderer__WEBPACK_IMPORTED_MODULE_1__.SequenceRenderer,
    TreeViewRenderer: _renderer_tree_view_renderer__WEBPACK_IMPORTED_MODULE_2__.TreeViewRenderer
});

})();

XamlViewer = __webpack_exports__["default"];
/******/ })()
;
//# sourceMappingURL=test-viewer.js.map