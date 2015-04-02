angular.module('fanex.ng.dropdowntree', ['ngSanitize'])
	.filter("itemFormatFilter", function () {
	    return function (value, item, level, formatCallback) {
	        return formatCallback ? formatCallback(value, item.model, level) : value;
	    };
	})
 .provider('dropdowntreeConfig', function () {
    var config = { 
        hasFilter: true,
        hasToolbar: true,
        nameMember: "name",
        dataMember: null,
        childrenMember: "children",
        itemFormatter: null,
        templateUrl: "fanex.directive.dropdowntree.template.html",
        sourceData: null,
        sourceUrl: null
    };
    return {
      set: function (options) {
        angular.extend(config, options);
      },
      $get: function () {
        return angular.extend({}, config);
      }
    };
  })
  .directive('dropdowntree', ['$parse', '$compile', '$http', '$filter','dropdowntreeConfig',
    function ($parse, $compile, $http, $filter, dropdowntreeConfig) {
        function containsText(item, searchText) {

            var found = item.label.toLowerCase().indexOf(searchText.toLowerCase()) > -1;

            if (!found && item.children) {
                for (var i = 0; i < item.children.length; i++) {
                    found = containsText(item.children[i], searchText);
                    if (found) {
                        break;
                    }
                }
            }

            return found;
        }

        function setItemChecked(item, value) {
            if (item.disabled) {
                return;
            }

            item.checked = value;
            if (item.children) {
                for (var i = 0; i < item.children.length; i++) {
                    setItemChecked(item.children[i], value);
                }
            }

            setParentChecked(item);
        }

        function setParentChecked(item) {
            if (item.parent) {
                var parent = item.parent;
                var allChecked = true;
                for (var i = 0; i < parent.children.length; i++) {
                    if (!parent.children[i].checked) {
                        allChecked = false;
                        break;
                    }
                }

                parent.checked = allChecked;
                setParentChecked(parent);
            }
        }

        function isAllItemsChecked(items) {
            if (items) {
                var checkedAll = true;
                for (var i = 0; i < items.length; i++) {
                    if (!items[i].checked) {
                        checkedAll = false;
                        break;
                    }
                }

                return checkedAll;
            }

            return false;
        }

        function getCheckedItems(items) {
            var value = [];
            angular.forEach(items, function (item) {
                if (item.children && item.children.length > 0) {
                    var children = getCheckedItems(item.children);
                    value = value.concat(children);
                } else {
                    if (item.checked) value.push(item.model);
                }
            });

            return value;
        }

        return {
            restrict: 'E',
            require: 'ngModel',
            scope: {
                selectedItems: "=ngModel",
                settings: "=?",
                textSettings: "=?",
                ngOnCheckall: "&",
                ngOnOpen: "&",
                ngOnClose: "&"
            },
            link: function (scope, element, attrs, modelCtrl) {                
                var required = attrs.required || attrs.ngRequired;
                //  var changeHandler = scope.ngChange || angular.noop;// $parse(attrs.change)(scope) || angular.noop;
                var onCheckAllHandler = scope.ngOnCheckall || angular.noop;

                scope._settings = null;
                scope._textSettings = null;

                scope.searchText = {
                    value: ""
                };
                scope.collapseAll = false;
                scope.checkedAll = false;
                scope.items = []; // dropdown model items
                scope.header = "";
                scope.disabled = angular.isDefined(attrs.disabled) || $parse(attrs.ngDisabled)(scope);

                function createDropDownModelItem(modelItem) {
                    var item = {
                        label: modelItem[scope._settings.nameMember],
                        model: modelItem,
                        checked: modelItem.checked === true,
                        disabled: modelItem.disabled === true,
                        cssClass: modelItem.cssClass,
                        showChildren: true
                    };

                    if (modelItem[scope._settings.childrenMember]) {
                        item.children = [];
                        for (var i = 0; i < modelItem[scope._settings.childrenMember].length; i++) {
                            var child = createDropDownModelItem(modelItem[scope._settings.childrenMember][i]);
                            child.parent = item;
                            item.children.push(child);
                        }
                    }

                    return item;
                }

                function parseSourceData(sourceData) {
                    var items = [];
                    if (!sourceData) return;
                    for (var i = 0; i < sourceData.length; i++) {
                        var item = createDropDownModelItem(sourceData[i]);
                        items.push(item);
                    }

                    return items;
                }

                function getHeaderText(selectedItems) {
                    if (angular.isArray(selectedItems) === false || selectedItems.length === 0) {
                        return scope._textSettings.NoItemChecked;
                    }

                    var header;

                    if (selectedItems.length < 10) {
                        var names = [];
                        var textLength = 0;
                        for (var i = 0; i < selectedItems.length; i++) {
                            var name = selectedItems[i][scope._settings.nameMember];

                            names.push(name);
                            textLength += name.length + 2; // 2 character of ", "

                            if (textLength > 15) {
                                return scope._textSettings.ItemsSelected.replace("#", selectedItems.length);
                            }
                        }

                        header = names.join(", ");
                    } else {
                        header = scope._textSettings.ItemsSelected.replace("#", selectedItems.length);
                    }

                    return header;
                }

                function refreshViewValue() {
                    var value = getCheckedItems(scope.items);
                    modelCtrl.$setViewValue(value);
                }

                function parseData() {
                    if(scope._settings.dataMember)
                    {
                        scope._settings.sourceData = scope._settings.sourceData[scope._settings.dataMember];
                    }
                            
                    scope.items = parseSourceData(scope._settings.sourceData);
                    scope.selectedItems = getCheckedItems(scope.items);
                }

                // required validate
                attrs.$observe('required', function (newVal) {
                    required = newVal;
                });

                scope.$watch("settings", function (newVal) {
                        scope._settings = angular.extend({}, dropdowntreeConfig, scope.settings);
                        if (typeof scope._settings.itemFormatter === "string") {
                            var filterInstance = $filter(scope._settings.itemFormatter);
                            scope._settings.itemFormatter = function (value, item, level) {
                                return filterInstance(value, item, level);
                            };
                        }

                        var sourceDataType = typeof scope._settings.sourceData;

                        if (sourceDataType === "string") // url
                        {
                            $http.get(scope._settings.sourceData)
				  .success(function (response) {
				      scope._settings.sourceData = response;
                      
				      parseData();
				  });
                        } else if (sourceDataType === "function") // function
                        {
                            scope._settings.sourceData = scope._settings.sourceData();
                            parseData();
                        }
                        else {
                            parseData();
                        }
                    
                }, true);

                scope.$watch("textSettings", function (newVal) {                
                    var defaultTextSettings = {
                        Filter: "Filter",
                        CheckAll: "Check all",
                        CollapseExpanse: "Collapse/Expanse",
                        CollapseBranch: "Collapse/Expanse this branch",
                        NoItemChecked: "Select options",
                        ItemsSelected: "# selected"
                    };

                    scope._textSettings = angular.extend(defaultTextSettings, scope.textSettings);
                    scope.header = getHeaderText(scope.selectedItems);
                }, true);

                //watch model change
                scope.$watch("selectedItems", function (newVal, oldVal) {
                    if (angular.isDefined(newVal)) {
                        //  scope.$eval(changeHandler);

                        scope.header = getHeaderText(scope.selectedItems);
                        modelCtrl.$setValidity('required', scope.valid());
                    }
                }, true);

                var popup = angular.element('<dropdowntree-popup></dropdowntree-popup>');
                element.append($compile(popup)(scope));

                scope.valid = function validModel() {
                    if (!required) return true;
                    var value = scope.selectedItems;
                    return (angular.isArray(value) && value.length > 0) ||
              (!angular.isArray(value) && value !== null);
                };

                scope.checkAll = function () {
                    scope.checkedAll = !scope.checkedAll;
                    angular.forEach(scope.items, function (item) {
                        setItemChecked(item, scope.checkedAll);
                    });
                    refreshViewValue();
                    onCheckAllHandler();
                };

                scope.checkItem = function (item) {
                    setItemChecked(item, !item.checked)
                    refreshViewValue();
                    scope.checkedAll = isAllItemsChecked(scope.items);
                };

                scope.getCollapseExpandClass = function (item) {
                    if (!item.children || item.children.length === 0)
                        return 'glyphicon-none';
                    return item.showChildren ? 'glyphicon-triangle-bottom' : 'glyphicon-triangle-right';
                };

                scope.getItemClass = function (item) {
                    return item.disabled ? 'disabled' : item.cssClass;
                };

                scope.toggleCollapseExpanse = function () {
                    scope.collapseAll = !scope.collapseAll;
                    angular.forEach(scope.items, function (item) {
                        item.showChildren = !scope.collapseAll;
                    });

                    refreshViewValue();
                };

                scope.filterSearchText = function (item) {
                    return scope.searchText.value ? containsText(item, scope.searchText.value) : true;
                };

                scope.clearSearchText = function () {
                    scope.searchText.value = "";
                    scope.focusSearchBox();
                };
            }
        };
    }
  ])

.directive('dropdowntreePopup', ['$document',
  function ($document) {
      return {
          restrict: 'E',
          replace: true,
          scope: false,
          // templateUrl: 'fanex.dropdowntree.template.html',
          template: '<div><div ng-include="_settings.templateUrl"></div><div>',
          link: function (scope, element, attrs, ctrl) {
              var onOpenHandler = scope.ngOnOpen || angular.noop;
              var onCloseHandler = scope.ngOnClose || angular.noop;

              var dropdownElement;

              function isElementInArray(element, elementArray) {
                  for (var i = 0; i < elementArray.length; i++)
                      if (element == elementArray[i])
                          return true;
                  return false;
              }

              function assignDropdownElement() {
                  if (!dropdownElement) {
                      dropdownElement = angular.element(element[0].querySelector('.dropdown'));
                  }
              }

              scope.toggleSelect = function () {
                  assignDropdownElement();
                  if (dropdownElement.hasClass('open')) {
                      dropdownElement.removeClass('open');
                      $document.unbind('click', clickHandler);
                      onCloseHandler();
                  } else {
                      dropdownElement.addClass('open');
                      $document.bind('click', clickHandler);
                      scope.focusSearchBox();
                      onOpenHandler();
                  }
              };

              function clickHandler(event) {
                  if (isElementInArray(event.target, element.find(event.target.tagName)))
                      return;
                  dropdownElement.removeClass('open');
                  $document.unbind('click', clickHandler);
                  onCloseHandler();
                  scope.$apply();
              }

              scope.focusSearchBox = function focusSearchBox() {
                  var searchBox = dropdownElement.find('input')[0];
                  searchBox.focus();
              }
          }
      }
  }
]);