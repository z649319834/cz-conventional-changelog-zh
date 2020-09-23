'format cjs';

var wrap = require('word-wrap');
var map = require('lodash.map');
var longest = require('longest');
var chalk = require('chalk');

var filter = function(array) {
  return array.filter(function(x) {
    return x;
  });
};

var headerLength = function(answers) {
  return (
    answers.type.length + 2 + (answers.scope ? answers.scope.length + 2 : 0)
  );
};

var maxSummaryLength = function(options, answers) {
  return options.maxHeaderWidth - headerLength(answers);
};

var filterSubject = function(subject, disableSubjectLowerCase) {
  subject = subject.trim();
  if (
    !disableSubjectLowerCase &&
    subject.charAt(0).toLowerCase() !== subject.charAt(0)
  ) {
    subject =
      subject.charAt(0).toLowerCase() + subject.slice(1, subject.length);
  }
  while (subject.endsWith('.')) {
    subject = subject.slice(0, subject.length - 1);
  }
  return subject;
};

// This can be any kind of SystemJS compatible module.
// We use Commonjs here, but ES6 or AMD would do just
// fine.
module.exports = function(options) {
  var types = options.types;
  var length = longest(Object.keys(types)).length + 1;
  var choices = map(types, function(type, key) {
    return {
      name: (key + ':').padEnd(length) + ' ' + type.description,
      value: key
    };
  });

  return {
    // When a user runs `git cz`, prompter will
    // be executed. We pass you cz, which currently
    // is just an instance of inquirer.js. Using
    // this you can ask questions and get answers.
    //
    // The commit callback should be executed when
    // you're ready to send back a commit template
    // to git.
    //
    // By default, we'll de-indent your commit
    // template and will keep empty lines.
    prompter: function(cz, commit) {
      // Let's ask some questions of the user
      // so that we can populate our commit
      // template.
      //
      // See inquirer.js docs for specifics.
      // You can also opt to use another input
      // collection library if you prefer.
      cz.prompt([
        {
          type: 'list',
          name: 'type',
          message: '选择您要提交的更改类型:',
          choices: choices,
          default: options.defaultType
        },
        {
          type: 'input',
          name: 'scope',
          message: '这个变化的范围是什么(例如组件或文件名):(按回车键跳过)',
          default: options.defaultScope,
          filter: function(value) {
            return options.disableScopeLowerCase
              ? value.trim()
              : value.trim().toLowerCase();
          }
        },
        {
          type: 'input',
          name: 'subject',
          message: function(answers) {
            return (
              '写一个简短的修改描述 (最多 ' +
              maxSummaryLength(options, answers) +
              ' 个字符):\n'
            );
          },
          default: options.defaultSubject,
          validate: function(subject, answers) {
            var filteredSubject = filterSubject(
              subject,
              options.disableSubjectLowerCase
            );
            return filteredSubject.length == 0
              ? '缺少修改描述'
              : filteredSubject.length <= maxSummaryLength(options, answers)
              ? true
              : '描述内容的长度必须小于或等于 ' +
                maxSummaryLength(options, answers) +
                ' 个字符. 当前长度为 ' +
                filteredSubject.length +
                ' 个字符.';
          },
          transformer: function(subject, answers) {
            var filteredSubject = filterSubject(
              subject,
              options.disableSubjectLowerCase
            );
            var color =
              filteredSubject.length <= maxSummaryLength(options, answers)
                ? chalk.green
                : chalk.red;
            return color('(' + filteredSubject.length + ') ' + subject);
          },
          filter: function(subject) {
            return filterSubject(subject, options.disableSubjectLowerCase);
          }
        },
        {
          type: 'input',
          name: 'body',
          message: '可以提供一个更长的修改描述:(按enter键跳过)\n',
          default: options.defaultBody
        },
        {
          type: 'confirm',
          name: 'isBreaking',
          message: '有什么重大的变化吗?',
          default: false
        },
        {
          type: 'input',
          name: 'breakingBody',
          default: '-',
          message: '一个重大的变化提交需要一个说明。请输入需要提交的说明:\n',
          when: function(answers) {
            return answers.isBreaking && !answers.body;
          },
          validate: function(breakingBody, answers) {
            return breakingBody.trim().length > 0 || '主要的变化描述是必须的';
          }
        },
        {
          type: 'input',
          name: 'breaking',
          message: '请描述重大的变化内容:\n',
          when: function(answers) {
            return answers.isBreaking;
          }
        },

        {
          type: 'confirm',
          name: 'isIssueAffected',
          message: '这个变化会影响任何开放的issues吗?',
          default: options.defaultIssues ? true : false
        },
        {
          type: 'input',
          name: 'issuesBody',
          default: '-',
          message:
            '如果issues已关闭，则提交需要一个说明。请输入需要提交的说明:\n',
          when: function(answers) {
            return (
              answers.isIssueAffected && !answers.body && !answers.breakingBody
            );
          }
        },
        {
          type: 'input',
          name: 'issues',
          message: '添加一个已经存在的issues (e.g. "fix #123", "re #123".):\n',
          when: function(answers) {
            return answers.isIssueAffected;
          },
          default: options.defaultIssues ? options.defaultIssues : undefined
        }
      ]).then(function(answers) {
        var wrapOptions = {
          trim: true,
          cut: false,
          newline: '\n',
          indent: '',
          width: options.maxLineWidth
        };

        // parentheses are only needed when a scope is present
        var scope = answers.scope ? '(' + answers.scope + ')' : '';

        // Hard limit this line in the validate
        var head = answers.type + scope + ': ' + answers.subject;

        // Wrap these lines at options.maxLineWidth characters
        var body = answers.body ? wrap(answers.body, wrapOptions) : false;

        // Apply breaking change prefix, removing it if already present
        var breaking = answers.breaking ? answers.breaking.trim() : '';
        breaking = breaking
          ? 'BREAKING CHANGE: ' + breaking.replace(/^BREAKING CHANGE: /, '')
          : '';
        breaking = breaking ? wrap(breaking, wrapOptions) : false;

        var issues = answers.issues ? wrap(answers.issues, wrapOptions) : false;

        commit(filter([head, body, breaking, issues]).join('\n\n'));
      });
    }
  };
};
