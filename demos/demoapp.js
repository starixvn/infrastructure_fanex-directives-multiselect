var data = [
		{
			value: 1, 
			text: 'Asia',
			cssClass: "demo",
			items:[
				{
				    value: 11, text: 'Southeast Asia',
					items: [{ value: 111, text: 'Vietnam'}]
				},
				{value: 12, text: 'Japan', checked: true}
			]
		},
		{
			value:2, text: 'Europe',
			items:[
				{value:21, text: 'Spain', disabled: true},
				{
				    value: 22, text: 'Western Europe',
				    items: [
                        { value: 221, text: 'France' },
                        { value: 222, text: 'Italy' },
				    ]
				},
				{ value: 23, text: 'Turkey' }
			]
		},
		{value:3, text: 'Africa'}
	];
// data =[];
//for(var i = 0;i<100;i++)
//{
//    data.push({
//          value: i, 
//			text: i + 'Asia',
//			cssClass: "demo",
//			items:[
//				{
//				    value: i + "a", text: 'Southeast Asia',
//					items: [{ value: i + "aa", text: 'Vietnam'}]
//				},
//				{value: i + "b", text: 'Japan', checked: true}
//			]
//    });
//}

var app = angular.module('DemoApp', ['fanex.dropdowntree']);
app.config(function(dropdowntreeConfigProvider){
    dropdowntreeConfigProvider.set({
        idMember: "value",
        nameMember: "text",
        childrenMember: "items",
        templateUrl: "src/fanex.directive.dropdowntree.template.html?v=" + new Date().getTime(),
        sourceData: data
    });
});
app.run(function($rootScope, $templateCache) {
   $rootScope.$on('$viewContentLoaded', function() {
      $templateCache.removeAll();
   });
});
app.filter("myItemFilter", function(){
		return function(value, item, level){
				return item.text + " - " + item.value;
		};
	});
app.controller('DemoController', function ($scope) {
    $scope.hasFilter = true;
  //  $scope.selectedItems1 = [];
    $scope.showFilter = function () {
       // $scope.hasFilter = true;
       // $scope.data[0].disabled = true;
       // $scope.textSettings.NoItemChecked = "aaaaaaaaaaa";
        // $scope.settings1.hasFilter = false;
	   // $scope.settings2.hasFilter = false;
	    //$scope.settings1.sourceData[0].text = "aaaaaaaaaaaaaaaa";
        //alert(1);
        // console.log($scope.selectedItems1);
    };
	
	$scope.selectedItemChange = function(){
		alert(1);
	};


	$scope.settings1 = {
	  sourceData: data,
        checkedAll: false,
        collapsedAll: false,
        checkedFilter: function(item){            
            return item.value == 2;
        }
        // ,selectedMember: "text"
        //,templateUrl: templateUrl
	};
	
	$scope.settings2 = {
	  nameMember: "text",
      // dataMember: "records",
	  sourceData: "demos/data/test.json"
	};
	
	$scope.settings3 = {
	  nameMember: "text",
	  childrenMember: "items",
	  sourceData: function(){
		  return data;
	  }
	};
		
	$scope.settings6 = {
	  nameMember: "text",
	  childrenMember: "items",
	  sourceData: data,
	  itemFormatter: "myItemFilter"
	};
	
	$scope.settings7 = {
	  nameMember: "text",
	  childrenMember: "items",
	  sourceData: data,
	  itemFormatter: function(value, item){
		if(item.items && item.items.length > 0)
		{
			return value + " (" + item.items.length + ")";
		}
		
		return value;
	  }
	};
    $scope.allSelectedItems1 = [];
    $scope.$watch("allSelectedItems1", function(newVal){
        //console.log(newVal);
    });
	$scope.textSettings = {
	    Filter: "Please enter text",
		CheckAll: "Check all items",
		CollapseExpanse: "Collapse/Expanse",
		CollapseBranch: "Collapse/Expanse this branch",
		NoItemChecked: "Please select options",
		ItemsSelected: "# selected",
		AllItemsSelected: "All Items selected"
	}
});
