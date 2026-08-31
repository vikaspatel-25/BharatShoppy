import {Routes, Route} from 'react-router-dom';
import Home from '../pages/home.jsx';
import Product from '../pages/product.jsx';
import Store from '../pages/store.jsx';
import Search from "../pages/search.jsx";
import Header from '../components/layout/header/header.jsx';
import { Navigate } from "react-router-dom";
function AppRoutes(){
 return(<>
     <Header />
    <Routes>
        <Route path="/" element = {<Home/>} />
        <Route path='/home' element = {<Home/>} />
        <Route path="/search" element={<Search />} />
        <Route path="/product/:productId" element={<Product />} />
        <Route path="/store/:storeId" element={<Store />} />
    </Routes>
    </>
 );

}

export default AppRoutes;