# Rich Rich Daifugo - プロジェクトガイド

## プロジェクトビジョン

**「すべてのローカルルールを共存させたカオスバカゲー」**

大富豪（大貧民）の世の中に存在するすべてのローカルルールを組み合わせて、カオスを楽しむバカゲーを作る。

### 開発方針

- **段階的実装**: まずベーシックなゲームを完成させてから拡張する
- **ルールの共存**: すべてのローカルルールが同時に有効化される前提で設計
- **カオスの楽しさ**: 複数のルールが複雑に絡み合う状況を楽しむ
- **コミット習慣**: 実装や修正が完了したら、必ずコミットする

### 想定ローカルルール

実装予定のローカルルールの例：

1. **8切り** - 8を出すと場がリセットされる
2. **11バック（Jバック）** - Jが場にある間、強さ判定が逆転
3. **縛り** - 同じスートが2回連続で出されたら、次も同じスートでなければならない
4. **階段革命** - 5枚以上の階段でも革命が発動
5. **その他多数** - 将来的にさらに追加

### ルール間の相互作用の例

- **革命 + 11バック**: 両方有効なら通常モード、どちらか一方なら反転モード（XORロジック）
- **縛り + 革命**: 縛りは強さに関係なく適用される
- **8切り + 縛り**: 8を出すと縛りもリセットされる

## アーキテクチャ設計

### 設計原則

1. **テスト可能性**: すべてのバリデーターは純粋関数として実装
2. **疎結合**: 各バリデーターは独立して動作し、相互依存を最小化
3. **拡張性**: 新しいルールは新しいバリデーターとして追加可能
4. **明示性**: 検証の順序がパイプラインで明確
5. **段階的実装**: 基本機能を完成させてから拡張

### リファクタリングとコード品質の原則

このプロジェクトでは、以下の原則に基づいてコードの品質を維持します。

#### 1. 責務の分離（Separation of Concerns）

- ドメイン層とルール層を明確に分離する
- 各層は独立して変更可能であるべき
- インターフェースは最小限のプロパティのみ持つ

変更の影響範囲を局所化し、テスト容易性と再利用性を向上させます。

#### 2. DRY原則（Don't Repeat Yourself）

- 同じロジックを複数箇所に書かない
- 重複コードは共通メソッドに抽出する
- 3回以上の重複が発生したら必ずリファクタリング

バグ修正が一箇所で済み、変更時の修正漏れを防ぎます。

#### 3. 単一責務の原則（Single Responsibility Principle）

- 各メソッド・クラスは一つの責務のみ持つ
- メソッド名がその責務を明確に表現する
- 一つのメソッドが複数のことをしている場合は分割する

コードの理解が容易になり、テストが書きやすくなります。

#### 4. デッドコードの削除

- 使われていないコードは即座に削除する
- コメントアウトではなく削除（Gitで履歴は残る）
- 「将来使うかも」は削除の理由にならない

コードベースの見通しが良くなり、メンテナンスコストが削減されます。

#### 5. テスト駆動のリファクタリング

- すべてのリファクタリング前後でテストを実行
- テストが通らないリファクタリングは中断
- リファクタリング中は既存テストを変更しない（動作を変えないことの証明）

リグレッションを早期発見し、安全にコードを変更できます。

#### 6. アトミックコミット

- 一つのコミットは一つの論理的な変更のみ含む
- 大きなリファクタリングは複数のフェーズに分割
- 各コミットは単独でテストが通る状態にする

レビューが容易になり、必要に応じて個別にrevert可能です。

#### 7. BREAKING CHANGEの明示

- インターフェースや公開APIを変更する場合は明示的にマーク
- コミットメッセージに `BREAKING CHANGE:` を記載
- Conventional Commits形式を使用（`refactor!:`, `feat!:` など）

他の開発者への影響を明確化し、変更の重要度が一目で分かります。

### コアコンセプト

#### 1. RuleContext（ルールコンテキスト）

バリデーション時に必要なゲーム状態をすべて保持する。

```typescript
interface RuleContext {
  // ゲーム状態
  isRevolution: boolean;

  // 場の状態
  field: Field;
}
```

将来的には以下のような情報も追加される予定：

```typescript
interface RuleContext {
  isRevolution: boolean;
  field: Field;

  // 動的状態（縛り用）
  currentBinding?: {
    suit: CardSuit;
    count: number;
  };

  // 11バック状態
  isElevenBack: boolean;
}
```

#### 2. ValidationPipeline（検証パイプライン）

各検証ステップを順序付けて実行する。

```typescript
class ValidationPipeline {
  validate(player, cards, context) {
    // ステップ1: 基本検証（所有権、組み合わせ）
    if (!basicValidator.validate(...)) return false;

    // ステップ2: 追加制約（将来: 8切り、縛り）
    // if (!constraintValidator.validate(...)) return false;

    // ステップ3: 強さ判定（革命を考慮、将来: 11バックも考慮）
    return strengthValidator.validate(...);
  }
}
```

**検証順序の重要性**:
- 基本検証（所有権、組み合わせ）は常に最初
- 制約チェック（8切り、縛り）は強さ判定の前
- 強さ判定は最後（革命や11バックの状態を考慮）

#### 3. ContextAwareValidator（コンテキスト対応バリデーター）

各バリデーターは RuleContext を受け取り、コンテキストに基づいて動作を変える。

**現在の実装例（StrengthValidator）**:

```typescript
class StrengthValidator {
  validate(player, cards, context) {
    if (context.field.isEmpty()) {
      return { valid: true };
    }

    // PlayAnalyzer.canFollow で強さをチェック
    // context.isRevolution を渡して、革命時の強さ判定を行う
    return PlayAnalyzer.canFollow(fieldPlay, currentPlay, context.isRevolution);
  }
}
```

**将来の拡張例（11バック対応）**:

```typescript
class StrengthValidator {
  validate(player, cards, context) {
    // 強さ判定の反転ロジック
    // XOR: どちらか一方だけなら反転、両方または両方オフなら通常
    const shouldReverse = context.isRevolution !== context.isElevenBack;

    if (shouldReverse) {
      return currentStrength < fieldStrength;
    } else {
      return currentStrength > fieldStrength;
    }
  }
}
```

**将来の拡張例（ConstraintValidator）**:

```typescript
class ConstraintValidator {
  validate(player, cards, context) {
    // 8切りチェック（最優先）
    if (hasEight(cards)) {
      return { valid: true }; // 8は常に出せる
    }

    // 縛りチェック
    if (context.currentBinding) {
      if (!matchesSuit(cards, context.currentBinding.suit)) {
        return { valid: false, reason: '縛りが発動しています' };
      }
    }

    return { valid: true };
  }
}
```

### ディレクトリ構造

```
src/core/rules/
├── base/
│   └── RuleEngine.ts          # ValidationPipeline を使用
├── context/
│   └── RuleContext.ts         # バリデーション用コンテキスト
├── pipeline/
│   └── ValidationPipeline.ts  # 検証ステップのオーケストレーション
└── validators/
    ├── BasicValidator.ts      # 所有権・組み合わせ検証
    ├── StrengthValidator.ts   # 強さ判定（革命対応）
    └── ConstraintValidator.ts # 将来: 8切り・縛り検証
```

### データフロー

```
GameEngine
  └─> RuleEngine.validate(player, cards, field, gameState)
        └─> RuleContext を生成 { isRevolution, field }
        └─> ValidationPipeline.validate(player, cards, context)
              └─> BasicValidator.validate()
                    └─> 所有権チェック
                    └─> 組み合わせチェック
              └─> StrengthValidator.validate()
                    └─> PlayAnalyzer.canFollow(context.isRevolution)
```

## 新しいルールの追加方法

### ステップ1: RuleContext の拡張

新しいルールに必要な状態を RuleContext に追加する。

```typescript
// RuleContext.ts
export interface RuleContext {
  isRevolution: boolean;
  field: Field;

  // 新しい状態を追加
  currentBinding?: { suit: CardSuit; count: number };
  isElevenBack: boolean;
}
```

### ステップ2: バリデーターの作成

新しいバリデーターを作成する（または既存のバリデーターを拡張する）。

```typescript
// validators/ConstraintValidator.ts
export class ConstraintValidator {
  validate(
    player: Player,
    cards: Card[],
    context: RuleContext
  ): ValidationResult {
    // 新しいルールのロジックを実装
    // ...
    return { valid: true };
  }
}
```

### ステップ3: パイプラインに追加

ValidationPipeline に新しいバリデーターを追加する。

```typescript
// pipeline/ValidationPipeline.ts
export class ValidationPipeline {
  private basicValidator: BasicValidator;
  private constraintValidator: ConstraintValidator; // 追加
  private strengthValidator: StrengthValidator;

  constructor() {
    this.basicValidator = new BasicValidator();
    this.constraintValidator = new ConstraintValidator(); // 追加
    this.strengthValidator = new StrengthValidator();
  }

  validate(player: Player, cards: Card[], context: RuleContext): ValidationResult {
    const basicResult = this.basicValidator.validate(player, cards, context);
    if (!basicResult.valid) return basicResult;

    // 新しいステップを追加
    const constraintResult = this.constraintValidator.validate(player, cards, context);
    if (!constraintResult.valid) return constraintResult;

    return this.strengthValidator.validate(player, cards, context);
  }
}
```

### ステップ4: GameState の更新

必要に応じて GameState に新しい状態を追加する。

```typescript
// domain/game/GameState.ts
export interface GameState {
  // 既存のフィールド
  isRevolution: boolean;

  // 新しい状態を追加
  currentBinding?: { suit: CardSuit; count: number };
  isElevenBack: boolean;
}
```

### ステップ5: RuleEngine での RuleContext 生成を更新

RuleEngine.validate() で RuleContext を生成する際、新しい状態を含める。

```typescript
// base/RuleEngine.ts
validate(player, cards, field, gameState) {
  const context: RuleContext = {
    isRevolution: gameState.isRevolution,
    field: field,
    // 新しい状態を追加
    currentBinding: gameState.currentBinding,
    isElevenBack: gameState.isElevenBack,
  };
  return this.pipeline.validate(player, cards, context);
}
```

## テスト戦略

### テスタビリティの原則

1. **依存性の注入**: バリデーターは外部依存を持たず、すべて引数で受け取る
2. **純粋関数**: 副作用なし、同じ入力には常に同じ出力
3. **小さな単位**: 各バリデーターは単一の責務のみ持つ
4. **モック不要**: RuleContext はプレーンなオブジェクトなので簡単に構築可能

### テストレベル

#### 1. ユニットテスト（各バリデーター）

```typescript
describe('StrengthValidator', () => {
  const validator = new StrengthValidator();

  it('革命中は弱いカードが出せる', () => {
    const context: RuleContext = {
      isRevolution: true,
      field: createMockField([{ rank: 'K' }]),
    };

    const result = validator.validate(player, [{ rank: '3' }], context);
    expect(result.valid).toBe(true);
  });
});
```

#### 2. 統合テスト（ValidationPipeline）

```typescript
describe('ValidationPipeline', () => {
  it('所有していないカードは出せない', () => {
    const pipeline = new ValidationPipeline();
    const result = pipeline.validate(player, notOwnedCards, context);
    expect(result.valid).toBe(false);
  });
});
```

#### 3. E2Eテスト（実際のゲームフロー）

```typescript
describe('カオスルールの組み合わせ', () => {
  it('革命中でも基本ルールは適用される', async () => {
    // 実際のゲームエンジンを使用してシナリオテスト
  });
});
```

### テストヘルパー

```typescript
// テストで使用するヘルパー関数
export function createMockContext(overrides?: Partial<RuleContext>): RuleContext {
  return {
    isRevolution: false,
    field: new Field(),
    ...overrides,
  };
}

export function createMockField(cards: Partial<Card>[]): Field {
  // Field オブジェクトを簡単に構築
}
```

## 実装の歴史

### Phase 1: アーキテクチャ基盤の構築（完了）

- RuleContext の作成
- BasicValidator の作成（所有権、組み合わせ）
- StrengthValidator の作成（革命対応）
- ValidationPipeline の作成
- RuleEngine の置き換え

### Phase 2: ローカルルールの追加（今後）

- ConstraintValidator の作成（8切り、縛り）
- GameState への RuleContext 情報追加
- 階段革命の実装

### Phase 3: さらなる拡張（今後）

- 11バック（Jバック）の実装
- その他のローカルルール
- ルール組み合わせの最適化

## 既知の制限事項と今後の改善

### 現在の制限

1. **ローカルルールの切り替え**: 現在はすべてのルールが有効前提（将来的に設定可能にする可能性）
2. **ルール間の優先度**: 8切りなど一部のルールは他のルールより優先される（明示的な順序付けが必要）
3. **パフォーマンス**: すべての組み合わせを列挙する方式（2^n）は手札が多いと重い（最適化の余地あり）

### 今後の改善案

1. **ルール設定UI**: どのローカルルールを有効化するか選択可能に
2. **パフォーマンス最適化**: よく使われる組み合わせのキャッシュ
3. **デバッグツール**: バリデーション失敗時の詳細な理由表示

## コーディング規約

### 命名規則

- **クラス**: PascalCase（例: `ValidationPipeline`）
- **インターフェース**: PascalCase（例: `RuleContext`）
- **メソッド**: camelCase（例: `validate`）
- **変数**: camelCase（例: `isRevolution`）

### ファイル構成

- **1ファイル1クラス/インターフェース**: 可読性とメンテナンス性のため
- **index.ts は使わない**: 明示的なインポートパスを使用
- **循環依存の回避**: 依存グラフは常に一方向

### コメント

- **日本語コメント**: ビジネスロジックの説明に使用
- **英語コメント**: 技術的な詳細に使用
- **コード自体が説明的**: 過度なコメントは避ける

## よくある質問

### Q: なぜ FORCE_ALLOW 方式をやめたのか？

A: FORCE_ALLOW 方式では、優先度が固定されており、複数のルールが複雑に絡み合う状況（革命 + 縛り + 11バックなど）を制御できないため。新しい方式では、RuleContext と ValidationPipeline により、ルール間の相互作用を明示的に制御できる。

### Q: なぜバリデーターを分割したのか？

A: 単一責任原則に基づき、各バリデーターは一つの責務のみを持つ。これにより、テストが容易になり、新しいルールの追加が簡単になる。また、バリデーションの順序が ValidationPipeline で明確になる。

### Q: なぜ RuleContext を引数で渡すのか？

A: テスト可能性のため。RuleContext を引数で渡すことで、バリデーターは純粋関数として実装でき、モックなしで簡単にテストできる。また、バリデーター間の依存関係を最小化できる。

### Q: 新しいローカルルールを追加するのは難しい？

A: いいえ。基本的には以下の3ステップ：
1. RuleContext に必要な状態を追加
2. 新しいバリデーターを作成（または既存を拡張）
3. ValidationPipeline に追加

既存のコードへの影響は最小限に抑えられる設計になっている。

## 参考資料

- [大富豪 - Wikipedia](https://ja.wikipedia.org/wiki/%E5%A4%A7%E5%AF%8C%E8%B1%AA)
- [大富豪のローカルルール一覧](https://ja.wikipedia.org/wiki/%E5%A4%A7%E5%AF%8C%E8%B1%AA#%E3%83%AD%E3%83%BC%E3%82%AB%E3%83%AB%E3%83%AB%E3%83%BC%E3%83%AB)

---

最終更新: 2025-12-27
