/*global angular */
(function () {
    "use strict";
    angular.module('fanex.dropdowntree', [])
        .filter("itemFormatFilter", function () {
            return function (value, item, level, formatCallback) {
                return formatCallback ? formatCallback(value, item.model, level) : value;
            };
        })
        .provider('dropdowntreeConfig', function () {
            var config = {
                collapsedAll: false, // temp setting, not 2 way binding
                checkedAll: false, // temp setting
                hasFilter: true,
                hasToolbar: true,
                idMember: "id",
                nameMember: "name",
                selectedMember: null,
                dataMember: null,
                childrenMember: "children",
                itemFormatter: null,
                templateUrl: "fanex.directive.dropdowntree.template.html",
                sourceData: null,
                checkedFilter: null, // function to checked item
                width: 250,
                height: null, // auto
                maxTextLength: 100
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
        .directive('dropdowntree', ['$parse', '$compile', '$http', '$filter', 'dropdowntreeConfig',
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

                function setParentChecked(item) {
                    if (item.parent) {
                        var parent = item.parent;
                        var allChecked = true;
                        for (var i = 0; i < parent.children.length; i++) {
                            var child = parent.children[i];
                            if (!child.disabled && !child.checked) {
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

                function createDropDownModelItem(settings, modelItem) {
                    var itemLabel = modelItem[settings.nameMember];
                    var item = {
                        id: settings.idMember ? modelItem[settings.idMember] : undefined,
                        label: itemLabel ? itemLabel.substr(0, settings.maxTextLength) : '',
                        model: modelItem,
                        checked: modelItem.checked === true ||
                            (settings.checkedFilter && settings.checkedFilter(modelItem)),
                        disabled: modelItem.disabled === true,
                        cssClass: modelItem.cssClass,
                        showChildren: true
                    };

                    if (modelItem[settings.childrenMember]) {
                        item.children = [];
                        var children = modelItem[settings.childrenMember];
                        var length = children.length;
                        for (var i = 0; i < length; i++) {
                            var child = createDropDownModelItem(settings, children[i]);
                            child.parent = item;
                            item.children.push(child);
                        }
                    }

                    return item;
                }

                // RETURN 
                return {
                    restrict: 'E',
                    require: 'ngModel',
                    scope: {
                        selectedItems: "=ngModel",
                        allSelectedItems: "=?",
                        settings: "=?",
                        textSettings: "=?",
                        ngOnCheckall: "&",
                        ngOnOpen: "&",
                        ngOnClose: "&",
                        ngChange: "&",
                        disabled: '=ngDisabled'
                    },
                    link: function (scope, element, attrs, modelCtrl) {
                        var required = attrs.required || attrs.ngRequired;
                        var changeHandler = scope.ngChange || angular.noop; // $parse(attrs.change)(scope) || angular.noop;
                        var onCheckAllHandler = scope.ngOnCheckall || angular.noop;

                        var _leafCheckedNames = [];

                        scope._settings = scope._settings = angular.extend({}, dropdowntreeConfig);
                        scope._textSettings = {};

                        scope.searchText = {
                            value: ""
                        };
                        scope.collapsedAll = false;
                        scope.checkedAll = false;
                        scope.items = []; // dropdown model items
                        scope.header = "";
                        var _isWatchSelectedItems = true;
                        var _isInnerCheckItem = false;

                        // scope.disabled = angular.isDefined(attrs.disabled) || $parse(attrs.ngDisabled)(scope);

                        function getCheckedItems(items) {
                            var checkedItems = [];
                            var leafCheckedItems = [];
                            var leafCheckedNames = [];
                            var length = items.length;
                            for (var i = 0; i < length; i++) {
                                var item = items[i];
                                if (item.checked) {
                                    var cloneItem = angular.copy(item.model, {});
                                    delete cloneItem[scope._settings.childrenMember];
                                    checkedItems.push(scope._settings.selectedMember ?
                                                      cloneItem[scope._settings.selectedMember] :
                                                      cloneItem);
                                }

                                if (item.children && item.children.length > 0) {
                                    var children = getCheckedItems(item.children);
                                    leafCheckedItems = leafCheckedItems.concat(children.leafItems);
                                    checkedItems = checkedItems.concat(children.allItems);
                                    leafCheckedNames = leafCheckedNames.concat(children.leafNames);
                                } else {
                                    if (item.checked) {
                                        leafCheckedItems.push(scope._settings.selectedMember ?
                                                              item.model[scope._settings.selectedMember] :
                                                              item.model);
                                        leafCheckedNames.push(item.model[scope._settings.nameMember]);
                                    }
                                }
                            }

                            return {
                                leafNames: leafCheckedNames,
                                leafItems: leafCheckedItems,
                                allItems: checkedItems
                            };
                        }


                        function setItemChecked(item, value) {
                            if (item.disabled) {
                                return;
                            }
                            _isInnerCheckItem = true;
                            item.checked = value;
                            if (item.children) {
                                for (var i = 0; i < item.children.length; i++) {
                                    setItemChecked(item.children[i], value);
                                }
                            }

                            setParentChecked(item);
                            _isInnerCheckItem = false;
                        }

                        function parseSourceData(sourceData) {
                            var items = [];
                            if (!sourceData) {
                                return;
                            }
                            var settings = scope._settings;
                            var length = sourceData.length;
                            for (var i = 0; i < length; i++) {
                                var item = createDropDownModelItem(settings, sourceData[i]);
                                items.push(item);
                            }

                            return items;
                        }

                        function getHeaderText(selectedItems) {
                            if (angular.isArray(scope._settings.sourceData) === false || scope._settings.sourceData.length === 0) {
                                return scope._textSettings.NoData;
                            }
                            if (angular.isArray(_leafCheckedNames) === false || _leafCheckedNames.length === 0) {
                                return scope._textSettings.NoItemChecked;
                            }

                            var header;

                            if (_leafCheckedNames.length < 10) {
                                var names = [];
                                var textLength = 0;
                                for (var i = 0; i < _leafCheckedNames.length; i++) {
                                    var name = _leafCheckedNames[i];

                                    names.push(name);
                                    textLength += name.length + 2; // 2 character of ", "

                                    if (textLength > 15) {
                                        return scope._textSettings.ItemsSelected.replace("#", selectedItems.length);
                                    }
                                }

                                header = names.join(", ");
                            } else {
                                header = scope._textSettings.ItemsSelected.replace("#", _leafCheckedNames.length);
                            }

                            return header;
                        }

                        function refreshViewValue(isRefreshSelectedItems) {
                            var data = getCheckedItems(scope.items);
                            _leafCheckedNames = data.leafNames;
                            scope.allSelectedItems = data.allItems;
                            if (isRefreshSelectedItems) {
                                scope.selectedItems = data.leafItems;
                            }
                        }

                        function parseData() {
                            if (scope._settings.dataMember) {
                                scope._settings.sourceData = scope._settings.sourceData[scope._settings.dataMember];
                            }

                            scope.items = parseSourceData(scope._settings.sourceData);
                            var data = getCheckedItems(scope.items);
                            _leafCheckedNames = data.leafNames;
                            scope.selectedItems = data.leafItems;
                            scope.allSelectedItems = data.allItems;
                            scope.checkedAll = isAllItemsChecked(scope.items);
                        }

                        function updateCheckedState(items, checkedItems) {

                            var idMember = scope._settings.idMember;
                            angular.forEach(items, function (item) {
                                var checked = false;
                                for (var i = 0; i < checkedItems.length; i++) {
                                    if (item.id === checkedItems[i][idMember]) {
                                        checked = true;
                                        break;
                                    }
                                }

                                item.checked = checked;

                                if (item.children && item.children.length > 0) {
                                    updateCheckedState(item.children, checkedItems);
                                }
                                setParentChecked(item);
                            });
                        }

                        // required validate
                        attrs.$observe('required', function (newVal) {
                            required = newVal;
                        });

                        scope.$watch("settings", function (newValue) {
                            if (!newValue) {
                                return;
                            }

                            scope._settings = angular.extend({}, dropdowntreeConfig, scope.settings);
                            if (typeof scope._settings.itemFormatter === "string") {
                                var filterInstance = $filter(scope._settings.itemFormatter);
                                scope._settings.itemFormatter = function (value, item, level) {
                                    return filterInstance(value, item, level);
                                };
                            }

                            var sourceDataType = typeof scope._settings.sourceData;

                            function startParseData() {
                                setTimeout(function () {
                                    parseData();

                                    if (scope._settings.checkedAll === true) {
                                        scope.toggleCheckAll(true);
                                    }

                                    scope.toggleCollapseExpanse(scope._settings.collapsedAll);
                                }, 100);
                            }

                            if (sourceDataType === "string") // url
                            {
                                $http.get(scope._settings.sourceData)
                                    .success(function (response) {
                                        scope._settings.sourceData = response;

                                        startParseData();
                                    });
                            } else if (sourceDataType === "function") // function
                            {
                                scope._settings.sourceData = scope._settings.sourceData();
                                startParseData();
                            } else {
                                startParseData();
                            }
                        });

                        scope.$watch("textSettings", function () {
                            var defaultTextSettings = {
                                Filter: "Filter",
                                CheckAll: "Check all",
                                CollapseExpanse: "Collapse/Expanse",
                                CollapseBranch: "Collapse/Expanse this branch",
                                NoItemChecked: "Select options",
                                ItemsSelected: "# selected",
                                NoData: "(No Data)"
                            };

                            scope._textSettings = angular.extend(defaultTextSettings, scope.textSettings);
                            scope.header = getHeaderText(scope.selectedItems);
                        }, true);

                        //watch model change
                        scope.$watch("selectedItems", function (newVal) {
                            if (_isWatchSelectedItems === true && scope._settings && angular.isDefined(newVal)) {
                                _isWatchSelectedItems = false;

                                if (_isInnerCheckItem === false) {
                                    updateCheckedState(scope.items, newVal);
                                    refreshViewValue();
									
									if(newVal.length < scope.items.length){
										scope.checkedAll =false;
									}
                                }

                                changeHandler();

                                scope.header = getHeaderText(scope.selectedItems);

                                modelCtrl.$setValidity('required', scope.valid());
                                _isWatchSelectedItems = true;
                            }
                        });


                        var popup = angular.element('<dropdowntree-popup></dropdowntree-popup>');
                        element.append($compile(popup)(scope));

                        scope.valid = function validModel() {
                            if (!required) {
                                return true;
                            }
                            var value = scope.selectedItems;
                            return (angular.isArray(value) && value.length > 0) ||
                                (!angular.isArray(value) && value !== null);
                        };

                        scope.toggleCheckAll = function (value) {
                            if (typeof value === "boolean") {
                                scope.checkedAll = value;
                            } else {
                                scope.checkedAll = !scope.checkedAll;
                            }

                            angular.forEach(scope.items, function (item) {
                                setItemChecked(item, scope.checkedAll);
                            });
                            refreshViewValue(true);
                            onCheckAllHandler();
                        };

                        scope.checkItem = function (item) {
                            setItemChecked(item, !item.checked);
                            refreshViewValue(true);
                            scope.checkedAll = isAllItemsChecked(scope.items);
                        };

                        scope.getCollapseExpandClass = function (item) {
                            if (!item.children || item.children.length === 0) {
                                return 'glyphicon-none';
                            }
                            return item.showChildren ? 'glyphicon-triangle-bottom' : 'glyphicon-triangle-right';
                        };

                        scope.getItemClass = function (item) {
                            return item.disabled ? 'disabled' : item.cssClass;
                        };

                        scope.toggleCollapseExpanse = function (value) {
                            if (typeof value === "boolean") {
                                scope.collapsedAll = value;
                            } else {
                                scope.collapsedAll = !scope.collapsedAll;
                            }

                            angular.forEach(scope.items, function (item) {
                                item.showChildren = !scope.collapsedAll;
                            });

                            refreshViewValue(true);
                        };

                        scope.filterSearchText = function (item) {
                            return scope.searchText.value ? containsText(item, scope.searchText.value) : true;
                        };

                        scope.clearSearchText = function () {
                            scope.searchText.value = "";
                            scope.focusSearchBox();
                        };

                        scope.touched = function () {
                            modelCtrl.$setTouched();
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
                link: function (scope, element) {
                    var onOpenHandler = scope.ngOnOpen || angular.noop;
                    var onCloseHandler = scope.ngOnClose || angular.noop;
                    var dropdownElement;

                    function isElementInArray(element, elementArray) {
                        for (var i = 0; i < elementArray.length; i++) {
                            if (element === elementArray[i]) {
                                return true;
                            }
                        }
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
                        if (isElementInArray(event.target, element.find(event.target.tagName))) {
                            return;
                        }
                        dropdownElement.removeClass('open');
                        $document.unbind('click', clickHandler);
                        onCloseHandler();
                        scope.$apply();
                    }

                    scope.focusSearchBox = function focusSearchBox() {
                        var searchBox = dropdownElement.find('input')[0];
                        if (searchBox) {
                            searchBox.focus();
                        }
                    };
                }
            };
        }
    ]);
} ());