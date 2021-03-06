import TabBody from '../components/panel/tab'
import TabEditor from '../components/panel/tab.editor'
import { puffin } from '@mkenzo_8/puffin'
import RunningConfig from 'RunningConfig'
import Cross from '../components/icons/cross'
import UnSavedIcon from '../components/icons/file.not.saved'
import areYouSureDialog from '../defaults/dialogs/you.sure'
import normalizeDir from '../utils/directory.normalizer'

const fs = window.require("fs-extra")

function guessTabPosition(tab,tabsbar){
	const res = Object.keys(tabsbar.children).filter((tabChildren,index)=>{
		if( tabsbar.children[tabChildren] == tab ){
			return tabChildren
		}
	})[0]
	return Number(res)
}

function Tab({
	title,
	isEditor,
	directory ="",
	parentFolder,
	component,
	panel = RunningConfig.data.focusedPanel,
	id
}){

	const classSelector = `tab${directory?directory:id}`
	const openedTabs = document.getElementsByClassName(classSelector)
	if( openedTabs.length >= 1 ){
		/**
		 *  Tab already exists so it won't be rendered again
		*/
		openedTabs[0].props.state.emit('focusedMe')
		return {
			isCancelled : true,
			tabElement:openedTabs[0],
			tabState:openedTabs[0].props.state
		}
	}
	const tabState = new puffin.state({
		active:true,
		saved:true,
		parentFolder,
		panel
	})
	RunningConfig.on('isATabOpened',({directory:tabDir,id:tabID})=>{
		if( ( tabDir && tabDir ==  directory )||( tabID && tabID ==  id )){
			return {
				tabElement:TabComp.node
			}
		}
	})
	const TabComp = puffin.element(`
		<TabBody draggable="true" 
		classSelector="${classSelector}" 
		class="${classSelector}" 
		dragstart="$startDrag" 
		click="$focusTab" 
		active="{{active}}" 
		mouseover="$showCross" 
		mouseleave="$hideCross"
		dragenter="$dragEnter"
		dragleave="$dragLeave"
		dragover="$dragover"
		drop="$onDropped"
		>
			<p drop="$onDropped" classSelector="${classSelector}">
			${title}
			</p>
			<div drop="$onDropped"  classSelector="${classSelector}">
				<Cross  drop="$onDropped" classSelector="${classSelector}" style="opacity:0;" click="$closeTab"/>
			</div>
		</TabBody>
`,{
		components:{
			TabBody,
			Cross
		},
		methods:{
			dragover(e){
				e.preventDefault()	
				TabComp.node.classList.add("dragging")
			},
			dragEnter(e){
				e.preventDefault()
			},
			dragLeave(e){
				e.preventDefault()
				e.target.classList.remove("dragging")
			},
			onDropped(e){
				e.preventDefault()
				TabComp.node.classList.remove("dragging")
			},
			startDrag(e){
				event.dataTransfer.setData("classSelector", classSelector)
				const tabsBar = this.parentElement
				const tabPosition  = guessTabPosition(this,tabsBar)
				let classSelectorForNext = null
				if( tabsBar.children.length == 1){
					classSelectorForNext = null
				}else if( tabPosition == 0){
					classSelectorForNext = tabsBar.children[1].getAttribute("classSelector")
				}else{
					classSelectorForNext = tabsBar.children[tabPosition-1].getAttribute("classSelector")
				}
				event.dataTransfer.setData(
					"classSelectorForNext", 
					classSelectorForNext
				)
			},
			focusTab(){
				tabState.emit('focusedMe')
			},
			closeTab(e){
				e.stopPropagation()
				tabState.emit('close')
			},
			showCross(e){
				toggleCross(this.children[1].children[0],1)
			},
			hideCross(e){
				toggleCross(this.children[1].children[0],0)
				e.target.classList.remove("dragging")
			}
		},
		events:{
			mounted(){
				this.directory = directory
				tabState.on('focusedMe',()=>{
					RunningConfig.data.focusedTab = this
					RunningConfig.data.focusedPanel = this.parentElement.parentElement
					RunningConfig.emit('aTabHasBeenFocused',{
						tabElement:this,
						directory:normalizeDir(directory)
					})
					unfocusTabs(this)
					this.props.active = true
					this.scrollIntoView()
				})
				tabState.on('unfocusedMe',()=>{
					RunningConfig.emit('aTabHasBeenUnfocused',{
						tabElement:this,
						directory:normalizeDir(directory)
					})
					this.props.active = false
				})
				tabState.on('destroyed',()=>{
					RunningConfig.emit('aTabHasBeenClosed',{
						tabElement:this,
						directory:normalizeDir(directory)
					})
				})
				tabState.on('savedMe',()=>{
					if(!this.props.saved){
						toggleTabStatus({
							tabElement:this,
							newStatus:true,
							tabEditor:TabEditorComp.node
						})
						RunningConfig.emit('aTabHasBeenSaved',{
							tabElement:this,
							path:normalizeDir(directory),
							parentFolder
						})
					}
				})
				tabState.on('markAsSaved',()=>{
					if( !this.props.saved ){
						this.props.saved = true
						toggleTabStatus({
							tabElement:this,
							newStatus:true,
							tabEditor:TabEditorComp.node
						})
					}
				})
				tabState.on('unsavedMe',()=>{
					if(this.props.saved){
						toggleTabStatus({
							tabElement:this,
							newStatus:false,
							tabEditor:TabEditorComp.node
						})
						this.props.saved = false
						RunningConfig.emit('aTabHasBeenUnSaved',{
							tabElement:this,
							path:directory,
							parentFolder
						})
					}
				})
				tabState.on('changePanel',(newPanel)=>{
					tabState.data.panel = newPanel
					focusATab(this)
				})
				tabState.on('close',()=>{
					if(this.props.saved){
						focusATab(this)
						TabComp.node.remove()
						TabEditorComp.node.remove(); 
						tabState.emit('destroyed',{
							tabElement:TabComp.node
						})
					}else{
						new areYouSureDialog().then(()=>{
							focusATab(TabComp.node)
							TabComp.node.remove()
							TabEditorComp.node.remove(); 
							TabComp.node.props.state.emit('destroyed',{tabElement:TabComp.node})
						}).catch(()=>{
							// nothing, tab remains opened
						})
					}
				})
				this.getPanelTabs = ()=>{
					const tabs = this.parentElement.children
					return Object.keys(tabs).map((tab)=>{
						return {
							element:tabs[tab],
							fileName:tabs[tab].children[0].textContent,
							filePath:tabs[tab].getAttribute("classselector")
						}
					})
				}
				unfocusTabs(this)
				RunningConfig.data.focusedTab = this
				this.props.active = tabState.data.active
				this.props.saved = tabState.data.saved
				this.props.state = tabState
				this.isSaved = true
			}
		},
		props:["active"]
	})
	const TabEditorComp = puffin.element(`
		<TabEditor>
			${(()=>{
				if(component){
					return "<component/>"
				}else{
					return ""
				}
			})()}
		</TabEditor>
	`,{
			components:{
				TabEditor,
				component
			},
			events:{
				mounted(target){
					tabState.on('focusedMe',()=>{
						target.style.display = "flex"
						target.props.state = tabState
					})
					tabState.on('unfocusedMe',()=>{
						target.style.display = "none"
						target.props.state = tabState
					})
					tabState.on('changePanel',(newPanel)=>{
						newPanel.children[1].appendChild(target)
					})
					target.props.state = tabState
				}
			}
	})
	puffin.render(TabComp,panel.children[0])
	puffin.render(TabEditorComp,panel.children[1])
	return {
		tabElement:TabComp.node,
		bodyElement:TabEditorComp.node,
		tabState,
		isCancelled:false
	}
}

function toggleCross(target,state){
	target.style.opacity = state
}

function toggleTabStatus({
	tabElement,
	tabEditor,
	newStatus
	}){
	if( newStatus ){
		if(!tabElement.props.saved){
			
			saveFile(tabElement,()=>{
				RunningConfig.emit('tabSaved',{
					element:tabElement,
					parentFolder:tabElement.props.state.data.parentFolder
				})
				tabElement.children[1].children[0].style.display = "block"
				if( tabElement.children[1].children[1]!=null )
					tabElement.children[1].children[1].remove()
				tabElement.props.saved = true
			})
		}else{
			tabElement.children[1].children[0].style.display = "block"
			if( tabElement.children[1].children[1]!=null )
				tabElement.children[1].children[1].remove()
		}
	}else if(tabElement.props.saved){
		tabElement.props.saved = false
		tabElement.children[1].children[0].style.display = "none"
		const comp = puffin.element(`
			<UnSavedIcon click="$tryToClose"/>
		`,{
			components:{
				UnSavedIcon
			},
			methods:{
				tryToClose(){
					tabElement.props.state.emit('close')
				}
			}
		})
		puffin.render(comp,tabElement.children[1],{
			removeContent:false
		})
	} 
}

function saveFile(tab,callback){
	if( tab.directory ) {
		const  { client, instance } = RunningConfig.data.focusedEditor
		fs.writeFile(tab.directory, client.do('getValue',instance)).then(()=> {
			callback()
		}).catch((err)=>{
			console.log(err)
		})
	}else{
		callback()
	}

}

function unfocusTabs(tab){
	const tabsBar = tab.parentElement;
	const tabsBarChildren = tabsBar.children;
	for( let otherTab of tabsBarChildren){
		if( otherTab != tab ) {
			otherTab.props.state.emit('unfocusedMe')
		}
	}
}

function focusATab(fromTab){
	const tabsBar = fromTab.parentElement;
	const tabsBarChildren = tabsBar.children;
	const fromTabPosition = guessTabPosition(fromTab,tabsBar)
	const focusedTabPosition = guessTabPosition(RunningConfig.data.focusedTab,tabsBar)
	if( focusedTabPosition === 0 ){
		if( fromTabPosition < tabsBarChildren.length-1 ){
			tabsBarChildren[fromTabPosition+1].props.state.emit('focusedMe')
		}else if( tabsBarChildren.length === 1 ){
			RunningConfig.data.focusedTab = null
			RunningConfig.data.focusedEditor = null
		}
	}else if( focusedTabPosition !== 0 && (fromTabPosition  == focusedTabPosition ) || (focusedTabPosition == tabsBarChildren.length) ){
		tabsBarChildren[fromTabPosition-1].props.state.emit('focusedMe')
	}	
}

export default Tab